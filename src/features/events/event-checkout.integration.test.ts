import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { initializeEventCheckout } from "@/lib/supabase-helpers/event-tickets";

const pricing = { configured_pricing_mode: "paid", configured_price: 12.5, status: "active" as const };

describe("operational event checkout", () => {
  it("prices active/expired/pending/no memberships from current database state", () => withFixtures(async f => {
    const event = await f.createEvent(pricing);
    const tier = await f.createMembershipType();
    for (const [state, overrides, expected] of [
      ["active", { membership_type_id: tier.id, membership_expires_at: "2099-01-01T00:00:00Z" }, 0],
      ["expired", { membership_type_id: tier.id, membership_expires_at: "2000-01-01T00:00:00Z" }, 1250],
      ["pending", { membership_pre_ordered_type_id: tier.id }, 1250],
      ["none", {}, 1250],
    ] as const) {
      const user = await f.createUser(overrides);
      const result = await initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `${state}-${f.tag}`, freeOnly: false, expectedAmountCents: expected });
      expect(result).toMatchObject({ amount_cents: expected, failure_reason: null });
      const purchase = await f.supabase.from("purchases").select().eq("id", result.purchase_id!).single();
      expect(purchase.data).toMatchObject({ amount_cents: expected, status: expected ? "pending" : "completed", square_payment_id: null, square_customer_id: null });
      if (!expected) expect(purchase.data?.fulfilled_at).toBeTruthy();
    }
  }));

  it("grants only one concurrent paid initializer permission to start Square", () => withFixtures(async f => {
    const event = await f.createEvent(pricing);
    const user = await f.createUser();
    const input = { eventId: event.id, userId: user.id, idempotencyKey: `paid-retry-${f.tag}`, freeOnly: false, expectedAmountCents: 1250 };
    const results = await Promise.all([initializeEventCheckout(f.supabase, input), initializeEventCheckout(f.supabase, input)]);
    expect(results.filter(r => r.created)).toHaveLength(1);
    expect(results[0].purchase_id).toBe(results[1].purchase_id);
  }));

  it("atomically issues one ticket and receipt across concurrent and lost-response retries", () => withFixtures(async f => {
    const event = await f.createEvent({ ...pricing, configured_price: 0, configured_pricing_mode: "free", max_capacity: 1 });
    const user = await f.createUser();
    const input = { eventId: event.id, userId: user.id, idempotencyKey: `retry-${f.tag}`, freeOnly: true, expectedAmountCents: 0 };
    const results = await Promise.all([initializeEventCheckout(f.supabase, input), initializeEventCheckout(f.supabase, input)]);
    results.push(await initializeEventCheckout(f.supabase, input));
    expect(results.every(r => !r.failure_reason && r.purchase_id === results[0].purchase_id)).toBe(true);
    const tickets = await f.supabase.from("event_tickets").select().eq("event_id", event.id);
    expect(tickets.data).toHaveLength(1);
    expect(tickets.data?.[0]).toMatchObject({ purchase_id: results[0].purchase_id, user_id: user.id });
    const purchases = await f.supabase.from("purchases").select().eq("event_id", event.id);
    expect(purchases.data).toHaveLength(1);
    expect(purchases.data?.[0]).toMatchObject({ status: "completed", amount_cents: 0 });
  }));

  it("serializes the last seat and rolls back the losing purchase", () => withFixtures(async f => {
    const event = await f.createEvent({ ...pricing, configured_price: 0, max_capacity: 1 });
    const users = [await f.createUser(), await f.createUser()];
    const results = await Promise.all(users.map((user, i) => initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `seat-${i}-${f.tag}`, freeOnly: true })));
    expect(results.filter(r => r.purchase_id)).toHaveLength(1);
    expect(results.find(r => !r.purchase_id)?.failure_reason).toBe("SOLD_OUT");
    expect((await f.supabase.from("purchases").select().eq("event_id", event.id)).data).toHaveLength(1);
  }));

  it("keeps eligibility, closed windows and offer expiry authoritative", () => withFixtures(async f => {
    const user = await f.createUser();
    let index = 0;
    for (const [overrides, status, expiry, failure] of [
      [{ status: "draft" as const }, null, null, "EVENT_NOT_ACTIVE"],
      [{ registration_opens_at: "2099-01-01T00:00:00Z" }, null, null, "REGISTRATION_NOT_OPEN"],
      [{ registration_closes_at: "2000-01-01T00:00:00Z" }, null, null, "REGISTRATION_CLOSED"],
      [{ requires_application: true }, null, null, "APPLICATION_REQUIRED"],
      [{ requires_application: true }, "accepted", "2000-01-01T00:00:00Z", "OFFER_EXPIRED"],
      [{ requires_application: true }, "accepted", "2099-01-01T00:00:00Z", null],
      [{ requires_application: true }, "rejected", null, "APPLICATION_REQUIRED"],
    ] as const) {
      const event = await f.createEvent({ ...pricing, configured_price: 0, ...overrides, slug: `eligibility-${index++}-${f.tag}` });
      if (status) {
        const app = await f.supabase.from("event_applications").insert({ event_id: event.id, user_id: user.id, status, offer_expires_at: expiry });
        expect(app.error).toBeNull();
      }
      const result = await initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `eligibility-${index}-${f.tag}`, freeOnly: true });
      expect(result.failure_reason).toBe(failure);
      expect(Boolean(result.purchase_id)).toBe(!failure);
    }
  }));

  it("rejects stale/forged quotes and locks the snapshot against concurrent repricing", () => withFixtures(async f => {
    const event = await f.createEvent(pricing);
    const user = await f.createUser();
    const input = { eventId: event.id, userId: user.id, idempotencyKey: `quote-${f.tag}`, freeOnly: false, expectedAmountCents: 1250 };
    expect((await initializeEventCheckout(f.supabase, { ...input, freeOnly: true, expectedAmountCents: 0 })).failure_reason).toBe("PRICE_CHANGED");
    expect((await f.supabase.from("purchases").select().eq("event_id", event.id)).data).toHaveLength(0);
    const [checkout, edit] = await Promise.all([
      initializeEventCheckout(f.supabase, input),
      f.supabase.from("events").update({ configured_price: 15 }).eq("id", event.id),
    ]);
    if (checkout.purchase_id) {
      expect(edit.error?.message).toMatch(/Pricing is locked/);
      expect(checkout.amount_cents).toBe(1250);
    } else {
      expect(edit.error).toBeNull();
      expect(checkout.failure_reason).toBe("PRICE_CHANGED");
    }
  }));

  it("restricts initialization to service role and binds attempt keys to their owner/event", () => withFixtures(async f => {
    const event = await f.createEvent({ ...pricing, configured_price: 0 });
    const user = await f.createUser();
    const other = await f.createUser();
    const input = { eventId: event.id, userId: user.id, idempotencyKey: `bound-${f.tag}`, freeOnly: true };
    for (const viewer of [null, user]) await expect(initializeEventCheckout(clientAs(viewer), input)).rejects.toBeDefined();
    const receipt = await initializeEventCheckout(f.supabase, input);
    expect(receipt.purchase_id).toBeTruthy();
    expect((await initializeEventCheckout(f.supabase, { ...input, userId: other.id })).failure_reason).toBe("ATTEMPT_MISMATCH");
    const another = await f.createEvent({ ...pricing, configured_price: 0, slug: `another-${f.tag}` });
    expect((await initializeEventCheckout(f.supabase, { ...input, eventId: another.id })).failure_reason).toBe("ATTEMPT_MISMATCH");
    const visible = await clientAs(user).from("purchases").select().eq("id", receipt.purchase_id!);
    expect(visible.data).toHaveLength(1);
    expect((await clientAs(other).from("purchases").select().eq("id", receipt.purchase_id!)).data).toHaveLength(0);
  }));
});
