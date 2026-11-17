/**
 * Ticket-safety groundwork against the local database: live purchases,
 * eligibility before a purchase exists, staff test registration on free drafts
 * only, deletion when no member is affected, and remove_event_ticket. See
 * docs/event-states.md ("Live purchases", "Drafts for admins").
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { withFixtures, type Fixtures } from "@/test/integration";
import { initializeEventCheckout } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventPricingLocked } from "@/lib/supabase-helpers/events";
import { fetchEventDeletionBlockers } from "@/lib/supabase-helpers/event-mutations";

const paid = { configured_pricing_mode: "paid", configured_price: 12.5, status: "active" as const };
const free = { configured_pricing_mode: "free", configured_price: 0 };

async function purchasesOf(f: Fixtures, eventId: string) {
  const { data, error } = await f.supabase.from("purchases").select("id, status, user_id").eq("event_id", eventId);
  if (error) throw error;
  return data;
}

async function insertPurchase(f: Fixtures, eventId: string, userId: string, status: string, amount = 1000) {
  const { data, error } = await f.supabase.from("purchases").insert({
    event_id: eventId, user_id: userId, kind: "event_ticket", status, amount_cents: amount,
    currency: "CAD", idempotency_key: `${f.tag}-${randomUUID()}`,
  }).select().single();
  if (error) throw error;
  return data;
}

function deleteEvent(f: Fixtures, eventId: string) {
  return f.supabase.rpc("delete_admin_event_safely", { p_event_id: eventId, p_operation_id: f.track("admin_event_mutations", randomUUID()) });
}

describe("eligibility before a hold", () => {
  it("leaves no purchase for a sold-out, closed or expired-offer paid attempt", () => withFixtures(async f => {
    const user = await f.createUser();
    const other = await f.createUser();
    const soldOut = await f.createEvent({ ...paid, max_capacity: 1, slug: `sold-out-${f.tag}` });
    expect((await f.supabase.from("event_tickets").insert({ event_id: soldOut.id, user_id: other.id })).error).toBeNull();
    const closed = await f.createEvent({ ...paid, registration_closes_at: "2000-01-01T00:00:00Z", slug: `closed-${f.tag}` });
    const offered = await f.createEvent({ ...paid, requires_application: true, slug: `offer-${f.tag}` });
    expect((await f.supabase.from("event_applications").insert({ event_id: offered.id, user_id: user.id, status: "accepted", offer_expires_at: "2000-01-01T00:00:00Z" })).error).toBeNull();

    for (const [event, reason] of [[soldOut, "SOLD_OUT"], [closed, "REGISTRATION_CLOSED"], [offered, "OFFER_EXPIRED"]] as const) {
      const result = await initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `${reason}-${f.tag}`, freeOnly: false, expectedAmountCents: 1250 });
      expect(result).toMatchObject({ purchase_id: null, failure_reason: reason, created: false });
      expect((await purchasesOf(f, event.id)).filter(row => row.user_id === user.id)).toEqual([]);
    }
  }));

  it("refuses a canceled event at checkout and at reservation", () => withFixtures(async f => {
    const event = await f.createEvent({ ...paid, ...free });
    const user = await f.createUser();
    expect((await f.supabase.from("events").update({ canceled_at: new Date().toISOString() }).eq("id", event.id)).error).toBeNull();
    const result = await initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `canceled-${f.tag}`, freeOnly: true });
    expect(result.failure_reason).toBe("EVENT_CANCELED");
    expect(await purchasesOf(f, event.id)).toEqual([]);
    const reserved = await f.supabase.rpc("reserve_event_ticket", { p_event_id: event.id, p_user_id: user.id });
    expect(reserved.data?.[0]).toEqual({ ticket_id: null, failure_reason: "EVENT_CANCELED" });
  }));

  it("refuses a second ticket before inserting a paid purchase", () => withFixtures(async f => {
    const event = await f.createEvent(paid);
    const user = await f.createUser();
    expect((await f.supabase.from("event_tickets").insert({ event_id: event.id, user_id: user.id })).error).toBeNull();
    const result = await initializeEventCheckout(f.supabase, { eventId: event.id, userId: user.id, idempotencyKey: `again-${f.tag}`, freeOnly: false, expectedAmountCents: 1250 });
    expect(result.failure_reason).toBe("ALREADY_REGISTERED");
    expect(await purchasesOf(f, event.id)).toEqual([]);
  }));
});

describe("live purchases", () => {
  it("locks pricing and the registration mode for a pending purchase, but not for a canceled one", () => withFixtures(async f => {
    for (const status of ["canceled", "failed", "pending"] as const) {
      const event = await f.createEvent({ slug: `${status}-${f.tag}` });
      const user = await f.createUser();
      await insertPurchase(f, event.id, user.id, status);
      const locked = status === "pending";
      expect(await fetchEventPricingLocked(f.supabase, event.id)).toBe(locked);
      const pricing = await f.supabase.from("events").update({ regular_price: 12 }).eq("id", event.id);
      expect(pricing.error === null).toBe(!locked);
      const mode = await f.supabase.from("events").update({ requires_application: true }).eq("id", event.id);
      expect(mode.error === null).toBe(!locked);
      if (locked) expect(mode.error?.message).toMatch(/Registration mode is locked/);
    }
  }));

  it("counts a fully refunded purchase as dead and a partly refunded one as live", () => withFixtures(async f => {
    const event = await f.createEvent();
    const user = await f.createUser();
    const purchase = await insertPurchase(f, event.id, user.id, "completed");
    const live = async () => (await f.supabase.rpc("event_has_live_purchases", { p_event_id: event.id })).data;
    expect(await live()).toBe(true);
    expect((await f.supabase.from("purchases").update({ refunded_cents: 400 }).eq("id", purchase.id)).error).toBeNull();
    expect(await live()).toBe(true);
    expect((await f.supabase.from("purchases").update({ refunded_cents: 1000 }).eq("id", purchase.id)).error).toBeNull();
    expect(await live()).toBe(false);
    expect((await f.supabase.from("purchases").update({ refunded_cents: 1001 }).eq("id", purchase.id)).error).not.toBeNull();
  }));
});

describe("staff test registration", () => {
  it("registers staff on a free draft and refuses a paid draft before any purchase", () => withFixtures(async f => {
    const freeDraft = await f.createEvent({ ...free, status: "draft", slug: `free-draft-${f.tag}` });
    const paidDraft = await f.createEvent({ ...paid, status: "draft", slug: `paid-draft-${f.tag}` });
    const member = await f.createUser();
    for (const role of ["admin", "manager"] as const) {
      const staff = await f.createUser({ role_access: role });
      const result = await initializeEventCheckout(f.supabase, { eventId: freeDraft.id, userId: staff.id, idempotencyKey: `free-${role}-${f.tag}`, freeOnly: true });
      expect(result).toMatchObject({ failure_reason: null, amount_cents: 0 });
      const refused = await initializeEventCheckout(f.supabase, { eventId: paidDraft.id, userId: staff.id, idempotencyKey: `paid-${role}-${f.tag}`, freeOnly: false, expectedAmountCents: 1250 });
      expect(refused).toMatchObject({ purchase_id: null, failure_reason: "EVENT_NOT_ACTIVE" });
    }
    expect((await initializeEventCheckout(f.supabase, { eventId: freeDraft.id, userId: member.id, idempotencyKey: `member-${f.tag}`, freeOnly: true })).failure_reason).toBe("EVENT_NOT_ACTIVE");
    expect(await purchasesOf(f, paidDraft.id)).toEqual([]);
    expect(await purchasesOf(f, freeDraft.id)).toHaveLength(2);
    // Staff $0 tests on a draft are not live purchases.
    expect((await f.supabase.rpc("event_has_live_purchases", { p_event_id: freeDraft.id })).data).toBe(false);
  }));
});

describe("event deletion", () => {
  it("deletes an event with only staff test tickets, together with its dead purchases", () => withFixtures(async f => {
    const event = await f.createEvent({ ...free, status: "draft" });
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const member = await f.createUser();
    for (const staff of [admin, manager]) {
      expect((await initializeEventCheckout(f.supabase, { eventId: event.id, userId: staff.id, idempotencyKey: `${staff.id}-${f.tag}`, freeOnly: true })).failure_reason).toBeNull();
    }
    await insertPurchase(f, event.id, member.id, "failed", 0);
    await insertPurchase(f, event.id, member.id, "canceled", 0);
    expect(await fetchEventDeletionBlockers(f.supabase, event.id)).toEqual({ memberTickets: 0, memberOffers: 0, memberPendingPurchases: 0, livePurchases: false });

    const deletion = await deleteEvent(f, event.id);
    expect(deletion.error).toBeNull();
    expect((await f.supabase.from("events").select("id").eq("id", event.id)).data).toEqual([]);
    expect(await purchasesOf(f, event.id)).toEqual([]);
    expect((await f.supabase.from("event_tickets").select("id").eq("event_id", event.id)).data).toEqual([]);
  }));

  it("refuses to delete an event with a member ticket, and keeps everything", () => withFixtures(async f => {
    const event = await f.createEvent({ ...free, status: "draft" });
    const admin = await f.createUser({ role_access: "admin" });
    const member = await f.createUser();
    expect((await initializeEventCheckout(f.supabase, { eventId: event.id, userId: admin.id, idempotencyKey: `admin-${f.tag}`, freeOnly: true })).failure_reason).toBeNull();
    expect((await f.supabase.from("event_tickets").insert({ event_id: event.id, user_id: member.id })).error).toBeNull();
    expect(await fetchEventDeletionBlockers(f.supabase, event.id)).toMatchObject({ memberTickets: 1, livePurchases: false });

    const deletion = await deleteEvent(f, event.id);
    expect(deletion.error?.hint).toBe("EVENT_DELETE_PROTECTED");
    expect((await f.supabase.from("events").select("id").eq("id", event.id)).data).toHaveLength(1);
    expect(await purchasesOf(f, event.id)).toHaveLength(1);
    expect((await f.supabase.from("event_tickets").select("id").eq("event_id", event.id)).data).toHaveLength(2);
  }));
});

describe("remove_event_ticket", () => {
  it("removes the ticket and hands team ownership to the teammate who joined first", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "active", teams_enabled: true });
    const [owner, first, second, solo] = [await f.createUser(), await f.createUser(), await f.createUser(), await f.createUser()];
    const tickets = await f.supabase.from("event_tickets").insert([owner, first, second, solo].map(user => ({ event_id: event.id, user_id: user.id }))).select();
    expect(tickets.error).toBeNull();
    const ticketOf = (userId: string) => tickets.data!.find(ticket => ticket.user_id === userId)!.id;
    const teams = await f.supabase.from("teams").insert([{ event_id: event.id, owner_id: owner.id }, { event_id: event.id, owner_id: solo.id }]).select();
    expect(teams.error).toBeNull();
    const [shared, alone] = teams.data!;
    const members = await f.supabase.from("team_members").insert([
      { event_id: event.id, team_id: shared.id, user_id: owner.id, joined_at: "2026-01-01T00:00:00Z" },
      { event_id: event.id, team_id: shared.id, user_id: second.id, joined_at: "2026-01-03T00:00:00Z" },
      { event_id: event.id, team_id: shared.id, user_id: first.id, joined_at: "2026-01-02T00:00:00Z" },
      { event_id: event.id, team_id: alone.id, user_id: solo.id, joined_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(members.error).toBeNull();

    expect((await f.supabase.rpc("remove_event_ticket", { p_ticket_id: ticketOf(owner.id) })).data).toBe(true);
    expect((await f.supabase.from("teams").select("owner_id").eq("id", shared.id).single()).data?.owner_id).toBe(first.id);
    expect((await f.supabase.from("team_members").select("user_id").eq("team_id", shared.id)).data?.map(row => row.user_id).sort()).toEqual([first.id, second.id].sort());
    expect((await f.supabase.from("event_tickets").select("id").eq("id", ticketOf(owner.id))).data).toEqual([]);

    expect((await f.supabase.rpc("remove_event_ticket", { p_ticket_id: ticketOf(solo.id) })).data).toBe(true);
    expect((await f.supabase.from("teams").select("id").eq("id", alone.id)).data).toEqual([]);
    expect((await f.supabase.rpc("remove_event_ticket", { p_ticket_id: ticketOf(solo.id) })).data).toBe(false);
  }));
});
