/**
 * The payments audit's database guards, against the local database: abandoned
 * purchases, one live membership purchase per user, webhook claims, ticket
 * release and check-in of uncaptured tickets, and offers ended with a ticket.
 * Square is mocked; everything the database decides is real.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";

import type { UserInfoRow } from "@/lib/supabase/models";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";
import { mutateItemCheckIn } from "@/lib/supabase-helpers/item-check-in";
import { claimSquareWebhookEvent } from "@/lib/supabase-helpers/purchases";
import type { CheckoutRequestInput } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("./customer", () => ({
  ensureSquareCustomerId: vi.fn(async () => "customer-1"),
}));
vi.mock("./confirmation-email", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("./revalidation", () => ({ revalidatePurchasePaths: vi.fn() }));

const square = vi.hoisted(() => ({
  create: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/square/client", () => ({
  squareClient: { payments: square, refunds: { get: vi.fn() } },
  getSquareLocationId: () => "location-1",
  SQUARE_CURRENCY: "CAD",
}));

const { executeCheckoutForUser, processSquarePaymentEvent, SquareWebhookInProgressError } =
  await import("./fulfillment");

const db = createIntegrationClient();
const minute = 60 * 1000;

/** A tier's name and slug are unique, and a test may need two. */
function uniqueTier() {
  const suffix = randomUUID().slice(0, 8);
  return { name: `Integration tier ${suffix}`, slug: `it-tier-${suffix}` };
}

async function insertPurchase(
  fixtures: Fixtures,
  row: {
    user_id: string;
    kind: "membership" | "event_ticket";
    status: string;
    membership_type_id?: string;
    event_id?: string;
    square_payment_id?: string | null;
    created_at?: string;
    amount_cents?: number;
  }
) {
  const { data, error } = await db
    .from("purchases")
    .insert({
      amount_cents: 2000,
      currency: "CAD",
      idempotency_key: `${fixtures.tag}-${randomUUID()}`,
      ...row,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function purchaseStatus(id: string) {
  const { data, error } = await db.from("purchases").select("status, failure_reason").eq("id", id).single();
  if (error) throw error;
  return data;
}

function membershipInput(slug: string, expectedAmountCents: number): CheckoutRequestInput {
  return {
    kind: "membership",
    slug,
    token: "cnon:card-nonce-ok",
    expectedAmountCents,
    idempotencyKey: `it-${randomUUID()}`,
  };
}

async function member(fixtures: Fixtures) {
  // A complete non-UBC profile: eligible for any tier that allows it.
  return (await fixtures.createUser({ user_type: "nonUbc" })) as UserInfoRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  square.create.mockImplementation(async () => ({
    payment: { id: `payment-${randomUUID()}`, status: "COMPLETED" },
  }));
  square.cancel.mockResolvedValue({});
});

describe("abandoned purchases", () => {
  it("fails a pending purchase with no Square payment once it is old, and leaves the rest", () =>
    withFixtures(async (fixtures) => {
      const user = await member(fixtures);
      const event = await fixtures.createEvent({ status: "active" });
      const old = new Date(Date.now() - 20 * minute).toISOString();
      const abandoned = await insertPurchase(fixtures, { user_id: user.id, kind: "event_ticket", event_id: event.id, status: "pending", created_at: old });
      const fresh = await insertPurchase(fixtures, { user_id: user.id, kind: "event_ticket", event_id: event.id, status: "pending" });
      const withPayment = await insertPurchase(fixtures, { user_id: user.id, kind: "event_ticket", event_id: event.id, status: "pending", created_at: old, square_payment_id: `p-${randomUUID()}` });

      const { error } = await db.rpc("fail_abandoned_purchases");
      expect(error).toBeNull();

      expect(await purchaseStatus(abandoned.id)).toEqual({ status: "failed", failure_reason: "This payment did not go through. Please try again." });
      expect((await purchaseStatus(fresh.id)).status).toBe("pending");
      expect((await purchaseStatus(withPayment.id)).status).toBe("pending");
    }));

  it("lets the buyer retry a membership whose earlier attempt never reached Square", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType({ ...uniqueTier(), price: 20, eligible_user_types: ["nonUbc"] });
      const user = await member(fixtures);
      const stuck = await insertPurchase(fixtures, {
        user_id: user.id, kind: "membership", membership_type_id: tier.id, status: "pending",
        created_at: new Date(Date.now() - 20 * minute).toISOString(),
      });

      const result = await executeCheckoutForUser(user, membershipInput(tier.slug, 2000));

      expect(result).toMatchObject({ ok: true, resolution: "completed" });
      expect((await purchaseStatus(stuck.id)).status).toBe("failed");
      expect(square.create).toHaveBeenCalledOnce();
    }));

  it("marks a membership Square refused outright as failed, so it blocks nothing", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType({ ...uniqueTier(), price: 20, eligible_user_types: ["nonUbc"] });
      const user = await member(fixtures);
      square.create.mockRejectedValue(new SquareError({
        statusCode: 401,
        body: { errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED" }] },
      }));

      const result = await executeCheckoutForUser(user, membershipInput(tier.slug, 2000));
      expect(result).toMatchObject({ ok: false, terminal: true });

      const { data } = await db.from("purchases").select("status").eq("user_id", user.id);
      expect(data).toEqual([{ status: "failed" }]);
    }));
});

describe("one live membership purchase", () => {
  it("refuses a second live membership purchase for the same user in the database", () =>
    withFixtures(async (fixtures) => {
      const [a, b] = [
        await fixtures.createMembershipType({ ...uniqueTier(), eligible_user_types: ["nonUbc"] }),
        await fixtures.createMembershipType({ ...uniqueTier(), eligible_user_types: ["nonUbc"] }),
      ];
      const user = await member(fixtures);
      await insertPurchase(fixtures, { user_id: user.id, kind: "membership", membership_type_id: a.id, status: "pending" });

      await expect(
        insertPurchase(fixtures, { user_id: user.id, kind: "membership", membership_type_id: b.id, status: "authorized" })
      ).rejects.toMatchObject({ code: "23505" });
      // Settled attempts don't count.
      await insertPurchase(fixtures, { user_id: user.id, kind: "membership", membership_type_id: b.id, status: "failed" });
    }));

  it("won't charge for another tier while a membership payment is processing", () =>
    withFixtures(async (fixtures) => {
      const a = await fixtures.createMembershipType({ ...uniqueTier(), price: 20, eligible_user_types: ["nonUbc"] });
      const b = await fixtures.createMembershipType({ ...uniqueTier(), price: 20, eligible_user_types: ["nonUbc"] });
      const user = await member(fixtures);
      const paymentId = `payment-${randomUUID()}`;
      await insertPurchase(fixtures, { user_id: user.id, kind: "membership", membership_type_id: a.id, status: "pending", square_payment_id: paymentId });
      square.get.mockResolvedValue({ payment: { id: paymentId, status: "PENDING" } });

      const result = await executeCheckoutForUser(user, membershipInput(b.slug, 2000));

      expect(result).toMatchObject({ ok: false, terminal: true });
      expect(square.create).not.toHaveBeenCalled();
    }));

  it("refuses a membership whose price changed since checkout loaded", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType({ ...uniqueTier(), price: 25, eligible_user_types: ["nonUbc"] });
      const user = await member(fixtures);

      await expect(executeCheckoutForUser(user, membershipInput(tier.slug, 2000))).resolves.toMatchObject({
        ok: false,
        terminal: true,
        error: "This membership's price has changed. Refresh checkout to review the current price.",
      });
      expect(square.create).not.toHaveBeenCalled();
    }));

  it("grants a free tier without a card or Square", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType({ ...uniqueTier(), price: 0, eligible_user_types: ["nonUbc"] });
      const user = await member(fixtures);

      const result = await executeCheckoutForUser(user, { ...membershipInput(tier.slug, 0), token: null });

      expect(result).toMatchObject({ ok: true, resolution: "completed" });
      expect(square.create).not.toHaveBeenCalled();
      const { data } = await db.from("user_info").select("membership_type_id").eq("id", user.id).single();
      expect(data?.membership_type_id).toBe(tier.id);
    }));
});

describe("webhook claims and payment order", () => {
  it("asks a duplicate to retry while the first delivery runs, and takes over a stale claim", () =>
    withFixtures(async () => {
      const eventId = `it-${randomUUID()}`;
      try {
        const event = { event_id: eventId, event_type: "payment.updated", square_payment_id: "p-1" };
        expect(await claimSquareWebhookEvent(db, event)).toBe("claimed");
        expect(await claimSquareWebhookEvent(db, event)).toBe("in_progress");
        // Six minutes later the first delivery is presumed dead.
        expect(await claimSquareWebhookEvent(db, event, Date.now() + 6 * minute)).toBe("claimed");

        await db.from("square_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
        expect(await claimSquareWebhookEvent(db, event)).toBe("processed");

        const { data } = await db.from("square_webhook_events").select("payload, square_payment_id").eq("event_id", eventId).single();
        expect(data).toEqual({ payload: null, square_payment_id: "p-1" });
      } finally {
        await db.from("square_webhook_events").delete().eq("event_id", eventId);
      }
    }));

  it("throws SquareWebhookInProgressError for a delivery that finds the event claimed", () =>
    withFixtures(async () => {
      const eventId = `it-${randomUUID()}`;
      try {
        await claimSquareWebhookEvent(db, { event_id: eventId, event_type: "payment.updated", square_payment_id: "p-1" });
        await expect(processSquarePaymentEvent({
          eventId,
          type: "payment.updated",
          data: { object: { payment: { id: "p-1", status: "COMPLETED" } } },
        } as never)).rejects.toBeInstanceOf(SquareWebhookInProgressError);
      } finally {
        await db.from("square_webhook_events").delete().eq("event_id", eventId);
      }
    }));

  it("never moves a completed purchase back on an older payment.updated", () =>
    withFixtures(async (fixtures) => {
      const user = await member(fixtures);
      const event = await fixtures.createEvent({ status: "active" });
      const paymentId = `payment-${randomUUID()}`;
      const purchase = await insertPurchase(fixtures, { user_id: user.id, kind: "event_ticket", event_id: event.id, status: "completed", square_payment_id: paymentId });
      await db.from("purchases").update({ fulfilled_at: new Date().toISOString() }).eq("id", purchase.id);
      const eventId = `it-${randomUUID()}`;
      try {
        await processSquarePaymentEvent({
          eventId,
          type: "payment.updated",
          data: { object: { payment: { id: paymentId, status: "APPROVED" } } },
        } as never);
        expect((await purchaseStatus(purchase.id)).status).toBe("completed");
      } finally {
        await db.from("square_webhook_events").delete().eq("event_id", eventId);
      }
    }));
});

/** A ticket on `event` with a purchase in `status`, as checkout leaves it. */
async function ticketWithPurchase(fixtures: Fixtures, eventId: string, user: UserInfoRow, status: string, amountCents = 1000) {
  const purchase = await insertPurchase(fixtures, {
    user_id: user.id, kind: "event_ticket", event_id: eventId, status, amount_cents: amountCents,
    square_payment_id: amountCents > 0 ? `payment-${randomUUID()}` : null,
  });
  const { data, error } = await db
    .from("event_tickets")
    .insert({ event_id: eventId, user_id: user.id, purchase_id: purchase.id })
    .select()
    .single();
  if (error) throw error;
  return { purchase, ticket: data };
}

describe("tickets", () => {
  it("frees the holder's team spot when a voided hold releases their ticket", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", teams_enabled: true, max_team_size: 3 });
      const holder = (await fixtures.createUser()) as UserInfoRow;
      const teammate = (await fixtures.createUser()) as UserInfoRow;
      const { purchase } = await ticketWithPurchase(fixtures, event.id, holder, "authorized");
      await ticketWithPurchase(fixtures, event.id, teammate, "completed");
      const team = await db.from("teams").insert({ event_id: event.id, name: "Hold", owner_id: holder.id }).select().single();
      if (team.error) throw team.error;
      const members = await db.from("team_members").insert([
        { event_id: event.id, team_id: team.data.id, user_id: holder.id },
        { event_id: event.id, team_id: team.data.id, user_id: teammate.id },
      ]);
      if (members.error) throw members.error;

      await db.from("purchases").update({ status: "canceled" }).eq("id", purchase.id);
      expect((await db.rpc("release_event_ticket", { p_purchase_id: purchase.id })).error).toBeNull();

      const { data: tickets } = await db.from("event_tickets").select("user_id").eq("event_id", event.id);
      expect(tickets).toEqual([{ user_id: teammate.id }]);
      const { data: teams } = await db.from("teams").select("owner_id").eq("id", team.data.id).single();
      expect(teams?.owner_id).toBe(teammate.id);
      const { data: left } = await db.from("team_members").select("user_id").eq("team_id", team.data.id);
      expect(left).toEqual([{ user_id: teammate.id }]);
    }));

  it("won't check in a ticket whose payment Square hasn't captured", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ agenda_enabled: false });
      const admin = (await fixtures.createUser({ role_access: "admin" })) as UserInfoRow;
      const holder = (await fixtures.createUser()) as UserInfoRow;
      const day = await db.from("event_agenda_days").insert({ event_id: event.id, date: "2026-01-01", title: "Day" }).select().single();
      if (day.error) throw day.error;
      const item = await db.from("event_agenda_items").insert({
        event_agenda_day_id: day.data.id, title: "Doors", start_time: "10:00", end_time: "11:00",
        starts_at: "2026-01-01T18:00:00Z", ends_at: "2026-01-01T19:00:00Z", check_in: true,
      }).select().single();
      if (item.error) throw item.error;
      const session = await db.from("check_in_sessions").insert({ event_id: event.id, agenda_item_id: item.data.id, name: "Doors" }).select().single();
      if (session.error) throw session.error;
      const { purchase, ticket } = await ticketWithPurchase(fixtures, event.id, holder, "authorized");
      const staff = clientAs(admin);

      await expect(mutateItemCheckIn(staff, { eventId: event.id, itemId: item.data.id, code: ticket.qr_token }))
        .resolves.toEqual({ status: "rejected", reason: "payment_pending" });

      await db.from("purchases").update({ status: "completed" }).eq("id", purchase.id);
      await expect(mutateItemCheckIn(staff, { eventId: event.id, itemId: item.data.id, code: ticket.qr_token }))
        .resolves.toMatchObject({ status: "checked_in" });
    }));

  it("ends the applicant's offer when their ticket is voided or refunded in full", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", requires_application: true });
      const offerOf = async (user: UserInfoRow) => {
        const application = await db.from("event_applications").insert({ event_id: event.id, user_id: user.id }).select().single();
        if (application.error) throw application.error;
        const accepted = await db.from("event_applications")
          .update({ status: "accepted", offer_expires_at: new Date(Date.now() + 7 * 24 * 60 * minute).toISOString() })
          .eq("id", application.data.id);
        if (accepted.error) throw accepted.error;
        return application.data.id;
      };
      const offerExpired = async (applicationId: string) => {
        const { data } = await db.from("event_applications").select("status, offer_expires_at").eq("id", applicationId).single();
        return data!.status === "accepted" && Date.parse(data!.offer_expires_at!) <= Date.now();
      };

      const voided = (await fixtures.createUser()) as UserInfoRow;
      const voidedApplication = await offerOf(voided);
      const free = await ticketWithPurchase(fixtures, event.id, voided, "completed", 0);
      expect((await db.rpc("void_event_ticket", { p_ticket_id: free.ticket.id })).data).toBeNull();
      expect(await offerExpired(voidedApplication)).toBe(true);
      const { data: eligibility } = await db.rpc("event_ticket_eligibility", { p_event_id: event.id, p_user_id: voided.id });
      expect(eligibility).toBe("OFFER_EXPIRED");

      const refunded = (await fixtures.createUser()) as UserInfoRow;
      const refundedApplication = await offerOf(refunded);
      const paid = await ticketWithPurchase(fixtures, event.id, refunded, "completed", 1000);
      const refund = await db.rpc("apply_event_purchase_refund", { p_purchase_id: paid.purchase.id, p_refunded_cents: 1000 });
      expect(refund.data?.[0]).toMatchObject({ ticket_removed: true });
      expect(await offerExpired(refundedApplication)).toBe(true);
    }));
});
