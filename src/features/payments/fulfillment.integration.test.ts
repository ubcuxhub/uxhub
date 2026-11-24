/**
 * Event ticket checkout against the local database: fulfillment reserves
 * through `reserve_event_ticket` and undoes it through `release_event_ticket`.
 * Square is mocked; everything the database decides is real.
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";

import type { UserInfoRow } from "@/lib/supabase/models";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { fetchPurchasesForUser } from "@/lib/supabase-helpers/purchases";
import { fetchCheckInSessions, fetchCheckInStatuses } from "@/lib/supabase-helpers/check-ins";
import type { CheckoutRequestInput } from "./types";
import type { SquareRefundEvent } from "@/lib/square/webhook";

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
  getRefund: vi.fn(),
}));
vi.mock("@/lib/square/client", () => ({
  squareClient: { payments: square, refunds: { get: square.getRefund } },
  getSquareLocationId: () => "location-1",
  SQUARE_CURRENCY: "CAD",
}));

const { executeCheckoutForUser, processSquarePaymentEvent, processSquareRefundEvent } = await import(
  "./fulfillment"
);

const db = createIntegrationClient();
const day = 24 * 60 * 60 * 1000;

function checkoutInput(slug: string): CheckoutRequestInput {
  return {
    kind: "event_ticket",
    slug,
    token: "cnon:card-nonce-ok",
    idempotencyKey: `it-${randomUUID()}`,
  };
}

async function ticketsFor(eventId: string) {
  const { data, error } = await db
    .from("event_tickets")
    .select("id, user_id, purchase_id")
    .eq("event_id", eventId);
  if (error) throw error;
  return data;
}

async function purchaseFor(purchaseId: string) {
  const { data, error } = await db
    .from("purchases")
    .select("status, fulfilled_at, failure_reason")
    .eq("id", purchaseId)
    .single();
  if (error) throw error;
  return data;
}

async function buyer(fixtures: Fixtures, role: UserInfoRow["role_access"] = "basic") {
  return (await fixtures.createUser({ role_access: role })) as UserInfoRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  let payment = 0;
  square.create.mockImplementation(async () => ({
    payment: { id: `payment-${randomUUID()}-${payment++}`, status: "APPROVED" },
  }));
  square.complete.mockImplementation(async ({ paymentId }: { paymentId: string }) => ({
    payment: { id: paymentId, status: "COMPLETED" },
  }));
  square.cancel.mockResolvedValue({});
});

describe("event ticket checkout", () => {
  it.each(["free", "paid"] as const)("carries a new %s builder event through scheduled publication, checkout, check-in and history", (mode) =>
    withFixtures(async (fixtures) => {
      const now = Date.now();
      const starts = new Date(now - day).toISOString();
      const ends = new Date(now + day).toISOString();
      const opens = new Date(now - day / 2).toISOString();
      const closes = new Date(now + day / 2).toISOString();
      const slug = `release-${mode}-${fixtures.tag}`;
      const saved = await db.rpc("save_admin_event_builder", {
        p_event_id: null!, p_draft_id: null!, p_draft_revision: 0,
        p_slug: slug, p_expected_image_url: null!, p_expected_header_image_url: null!,
        p_event: {
          name: `Release ${mode}`, short_description: "Release lifecycle", description: "Saved event content.",
          status: "draft", publish_at: new Date(now + 60_000).toISOString(),
          starts_at: starts, ends_at: ends, registration_opens_at: opens, registration_closes_at: closes,
          max_capacity: 10, configured_marketing_mode: "disabled", configured_slug: slug,
          configured_pricing_mode: mode, configured_price: mode === "free" ? 0 : 12.5,
        },
        p_check_in_sessions: [{ name: "Door", start_time: starts, end_time: ends }],
        p_application_questions: [], p_mentors: [], p_sponsors: [],
      });
      expect(saved.error).toBeNull();
      const eventId = fixtures.track("events", (saved.data as { id: string }).id);
      const user = await buyer(fixtures);
      expect(await fetchEventById(clientAs(user), eventId)).toBeNull();

      // Make the persisted schedule due, then use the actual scheduler RPC.
      expect((await db.from("events").update({ publish_at: new Date(now - 60_000).toISOString() }).eq("id", eventId)).error).toBeNull();
      expect((await db.rpc("publish_due_events")).error).toBeNull();
      const published = await fetchEventById(clientAs(user), eventId);
      expect(published).toMatchObject({ status: "active", publish_at: null, description: "Saved event content.", pricing_policy: "figma", regular_price: mode === "free" ? 0 : 12.5, member_price: 0 });
      expect(Date.parse(published!.registration_opens_at!)).toBe(Date.parse(opens));
      expect(Date.parse(published!.registration_closes_at!)).toBe(Date.parse(closes));

      const request = { ...checkoutInput(slug), expectedAmountCents: mode === "free" ? 0 : 1250 };
      const result = await executeCheckoutForUser(user, request);
      expect(result).toMatchObject({ ok: true, resolution: "completed" });
      if (!result.ok) throw new Error("Checkout failed");
      const ticket = await fetchUserEventTicket(clientAs(user), eventId, user.id);
      expect(ticket).toMatchObject({ purchase_id: result.purchaseId });
      const history = await fetchPurchasesForUser(clientAs(user), user.id);
      expect(history).toContainEqual(expect.objectContaining({ id: result.purchaseId, status: "completed", amount_cents: request.expectedAmountCents }));
      const sessions = await fetchCheckInSessions(db, eventId);
      expect(sessions).toHaveLength(1);
      await db.from("check_ins").insert({ticket_id:ticket!.id,check_in_session_id:sessions[0].id,checked_in_at:new Date().toISOString()}).throwOnError();
      expect((await fetchCheckInStatuses(db, eventId)).get(`${ticket!.id}_${sessions[0].id}`)).toBeTruthy();
      expect(await fetchUserEventTicket(clientAs(user), eventId, user.id)).toMatchObject({ id: ticket!.id });
      if (mode === "free") expect(square.create).not.toHaveBeenCalled();
      else expect(square.create).toHaveBeenCalledWith(expect.objectContaining({ amountMoney: { amount: BigInt(1250), currency: "CAD" } }));
    }));

  it("issues the ticket for the purchase and fulfills it", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const user = await buyer(fixtures);

      const result = await executeCheckoutForUser(user, checkoutInput(event.slug));

      expect(result).toMatchObject({ ok: true, resolution: "completed" });
      const purchaseId = result.ok ? result.purchaseId : "";
      expect(await ticketsFor(event.id)).toEqual([
        expect.objectContaining({ user_id: user.id, purchase_id: purchaseId }),
      ]);
      expect(await purchaseFor(purchaseId)).toMatchObject({ status: "completed" });
      expect((await purchaseFor(purchaseId)).fulfilled_at).not.toBeNull();

      // A second checkout is refused before charging.
      square.create.mockClear();
      await expect(
        executeCheckoutForUser(user, checkoutInput(event.slug))
      ).resolves.toEqual({
        ok: false,
        error: "You already have a ticket for this event.",
        terminal: true,
      });
      expect(square.create).not.toHaveBeenCalled();
    }));

  it("releases the ticket when the capture is declined", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const user = await buyer(fixtures);
      square.complete.mockRejectedValue(
        new SquareError({
          message: "declined",
          body: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] },
        })
      );

      const result = await executeCheckoutForUser(user, checkoutInput(event.slug));

      expect(result).toMatchObject({ ok: false, terminal: true });
      expect(square.cancel).toHaveBeenCalled();
      expect(await ticketsFor(event.id)).toEqual([]);

      // The seat is free again, so the next attempt goes through.
      square.complete.mockImplementation(async ({ paymentId }: { paymentId: string }) => ({
        payment: { id: paymentId, status: "COMPLETED" },
      }));
      await expect(
        executeCheckoutForUser(user, checkoutInput(event.slug))
      ).resolves.toMatchObject({ ok: true, resolution: "completed" });
      expect(await ticketsFor(event.id)).toHaveLength(1);
    }));

  it("places no hold and leaves no purchase or ticket when the event is sold out", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", max_capacity: 1 });
      const first = await buyer(fixtures);
      const second = await buyer(fixtures);

      await executeCheckoutForUser(first, checkoutInput(event.slug));
      square.create.mockClear();
      const result = await executeCheckoutForUser(second, checkoutInput(event.slug));

      expect(result).toEqual({ ok: false, error: "This event is sold out.", terminal: true });
      expect(square.create).not.toHaveBeenCalled();
      expect(square.cancel).not.toHaveBeenCalled();
      expect((await fetchPurchasesForUser(db, second.id)).filter((row) => row.event_id === event.id)).toEqual([]);
      expect(await ticketsFor(event.id)).toEqual([
        expect.objectContaining({ user_id: first.id }),
      ]);
    }));

  it("releases the ticket when Square voids an uncaptured hold", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const user = await buyer(fixtures);
      // Capture times out, so the purchase stays authorized with its ticket.
      square.complete.mockRejectedValue(
        new SquareError({
          message: "timeout",
          body: { errors: [{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }] },
        })
      );

      const result = await executeCheckoutForUser(user, checkoutInput(event.slug));
      expect(result).toMatchObject({ ok: true, resolution: "processing" });
      const purchaseId = result.ok ? result.purchaseId : "";
      expect(await ticketsFor(event.id)).toHaveLength(1);

      const { data: purchase } = await db
        .from("purchases")
        .select("square_payment_id")
        .eq("id", purchaseId)
        .single();

      await processSquarePaymentEvent({
        eventId: `it-${randomUUID()}`,
        type: "payment.updated",
        data: {
          object: {
            payment: { id: purchase!.square_payment_id!, status: "CANCELED" },
          },
        },
      } as never);

      expect(await purchaseFor(purchaseId)).toMatchObject({ status: "canceled" });
      expect(await ticketsFor(event.id)).toEqual([]);
      await db.from("square_webhook_events").delete().like("event_id", "it-%");
    }));

  it("lets admins and managers test-register on free drafts only, and never holds a card for a paid one", () =>
    withFixtures(async (fixtures) => {
      const freeDraft = await fixtures.createEvent({ status: "draft", configured_pricing_mode: "free", configured_price: 0, slug: `free-draft-${fixtures.tag}` });
      const paidDraft = await fixtures.createEvent({ status: "draft", slug: `paid-draft-${fixtures.tag}` });
      const member = await buyer(fixtures);
      const admin = await buyer(fixtures, "admin");
      const manager = await buyer(fixtures, "manager");

      for (const event of [freeDraft, paidDraft]) {
        await expect(
          executeCheckoutForUser(member, checkoutInput(event.slug))
        ).resolves.toEqual({ ok: false, error: "Event not found.", terminal: true });
      }

      for (const staff of [admin, manager]) {
        await expect(
          executeCheckoutForUser(staff, checkoutInput(freeDraft.slug))
        ).resolves.toMatchObject({ ok: true, resolution: "completed" });
        await expect(
          executeCheckoutForUser(staff, checkoutInput(paidDraft.slug))
        ).resolves.toEqual({ ok: false, error: "This event is no longer open for registration.", terminal: true });
      }
      expect(square.create).not.toHaveBeenCalled();
      expect((await ticketsFor(freeDraft.id)).map((ticket) => ticket.user_id).sort()).toEqual(
        [admin.id, manager.id].sort()
      );
      expect(await ticketsFor(paidDraft.id)).toEqual([]);
      const { data: paidPurchases } = await db.from("purchases").select("id").eq("event_id", paidDraft.id);
      expect(paidPurchases).toEqual([]);
    }));

  it("sells an application event only on an accepted, unexpired offer", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", requires_application: true });
      const user = await buyer(fixtures);

      await expect(
        executeCheckoutForUser(user, checkoutInput(event.slug))
      ).resolves.toMatchObject({
        ok: false,
        error: "This event takes applications. You can register once your application is accepted.",
      });

      const { data: application, error } = await db
        .from("event_applications")
        .insert({ event_id: event.id, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      const expired = await db
        .from("event_applications")
        .update({ status: "accepted", offer_expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq("id", application.id);
      if (expired.error) throw expired.error;

      await expect(
        executeCheckoutForUser(user, checkoutInput(event.slug))
      ).resolves.toMatchObject({ ok: false, error: "Your offer for this event has expired." });

      const reoffered = await db
        .from("event_applications")
        .update({ offer_expires_at: new Date(Date.now() + day).toISOString() })
        .eq("id", application.id);
      if (reoffered.error) throw reoffered.error;

      await expect(
        executeCheckoutForUser(user, checkoutInput(event.slug))
      ).resolves.toMatchObject({ ok: true, resolution: "completed" });
      expect(await ticketsFor(event.id)).toHaveLength(1);
      // The refused attempts never reached Square, so there was no hold to void.
      expect(square.create).toHaveBeenCalledTimes(1);
      expect(square.cancel).not.toHaveBeenCalled();
    }));
});

describe("release_event_ticket", () => {
  it("keeps the ticket of a completed purchase or one with a check-in", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const session = await db
        .from("check_in_sessions")
        .insert({ event_id: event.id, name: "Door" })
        .select()
        .single();
      if (session.error) throw session.error;
      fixtures.track("check_in_sessions", session.data.id);

      const issue = async (status: "completed" | "authorized") => {
        const user = await buyer(fixtures);
        const { data: purchase, error } = await db
          .from("purchases")
          .insert({
            user_id: user.id,
            event_id: event.id,
            kind: "event_ticket",
            status,
            amount_cents: 1000,
            currency: "CAD",
            idempotency_key: `${fixtures.tag}-${randomUUID()}`,
          })
          .select()
          .single();
        if (error) throw error;
        const { data } = await db.rpc("reserve_event_ticket", {
          p_event_id: event.id,
          p_user_id: user.id,
          p_purchase_id: purchase.id,
        });
        return { purchaseId: purchase.id, ticketId: data![0].ticket_id! };
      };

      const completed = await issue("completed");
      const checkedIn = await issue("authorized");
      const pending = await issue("authorized");
      const checkIn = await db.from("check_ins").insert({
        ticket_id: checkedIn.ticketId,
        check_in_session_id: session.data.id,
        checked_in_at: new Date().toISOString(),
      });
      if (checkIn.error) throw checkIn.error;

      for (const { purchaseId } of [completed, checkedIn, pending]) {
        const { error } = await db.rpc("release_event_ticket", { p_purchase_id: purchaseId });
        if (error) throw error;
      }

      expect((await ticketsFor(event.id)).map((ticket) => ticket.id).sort()).toEqual(
        [completed.ticketId, checkedIn.ticketId].sort()
      );
    }));
});

describe("Square refunds", () => {
  const cad = (amount: number) => ({ amount: BigInt(amount), currency: "CAD" });

  /**
   * Square as it stands after the refunds: `payments.get` lists them and
   * `refunds.get` returns each with its status.
   */
  function squareRefunds(paymentId: string, amountCents: number, refunds: { status: string; cents: number }[]) {
    const completed = refunds.filter((refund) => refund.status === "COMPLETED");
    square.get.mockResolvedValue({
      payment: {
        id: paymentId,
        status: "COMPLETED",
        amountMoney: cad(amountCents),
        refundedMoney: cad(completed.reduce((sum, refund) => sum + refund.cents, 0)),
        refundIds: refunds.map((_, index) => `refund-${index}`),
      },
    });
    square.getRefund.mockImplementation(async ({ refundId }: { refundId: string }) => {
      const refund = refunds[Number(refundId.split("-")[1])];
      return { refund: { id: refundId, paymentId, status: refund.status, amountMoney: cad(refund.cents) } };
    });
  }

  function refundEvent(paymentId: string, eventId = `it-${randomUUID()}`): SquareRefundEvent {
    return {
      eventId,
      type: "refund.updated",
      data: { object: { refund: { id: "refund-0", paymentId } } },
    } as never;
  }

  async function paidTicket(fixtures: Fixtures) {
    const event = await fixtures.createEvent({ status: "active" });
    const user = await buyer(fixtures);
    const result = await executeCheckoutForUser(user, checkoutInput(event.slug));
    if (!result.ok) throw new Error("Checkout failed");
    const { data: purchase, error } = await db
      .from("purchases")
      .select("id, amount_cents, square_payment_id")
      .eq("id", result.purchaseId)
      .single();
    if (error) throw error;
    return { event, user, purchase: { ...purchase, square_payment_id: purchase.square_payment_id! } };
  }

  async function refundState(purchaseId: string) {
    const { data, error } = await db
      .from("purchases")
      .select("status, refunded_cents, refunded_at, fulfilled_at")
      .eq("id", purchaseId)
      .single();
    if (error) throw error;
    return data;
  }

  async function checkIn(fixtures: Fixtures, eventId: string, ticketId: string) {
    const session = await db.from("check_in_sessions").insert({ event_id: eventId, name: "Door" }).select().single();
    if (session.error) throw session.error;
    fixtures.track("check_in_sessions", session.data.id);
    await db.from("check_ins").insert({ ticket_id: ticketId, check_in_session_id: session.data.id, checked_in_at: new Date().toISOString() }).throwOnError();
  }

  afterEach(async () => {
    await db.from("square_webhook_events").delete().like("event_id", "it-%");
  });

  it("takes back the ticket and frees the seat on a full refund before check-in", () =>
    withFixtures(async (fixtures) => {
      const { event, purchase } = await paidTicket(fixtures);
      expect(await ticketsFor(event.id)).toHaveLength(1);

      squareRefunds(purchase.square_payment_id, purchase.amount_cents, [{ status: "COMPLETED", cents: purchase.amount_cents }]);
      await processSquareRefundEvent(refundEvent(purchase.square_payment_id));

      expect(await ticketsFor(event.id)).toEqual([]);
      expect(await refundState(purchase.id)).toMatchObject({ status: "completed", refunded_cents: purchase.amount_cents });
      expect((await refundState(purchase.id)).refunded_at).not.toBeNull();
      const { data: seats } = await db.rpc("event_seat_counts_unfiltered", { p_event_ids: [event.id] });
      expect(seats![0]).toMatchObject({ tickets: 0 });
    }));

  it("records nothing that removes access while the refund is pending", () =>
    withFixtures(async (fixtures) => {
      const { event, purchase } = await paidTicket(fixtures);

      squareRefunds(purchase.square_payment_id, purchase.amount_cents, [{ status: "PENDING", cents: purchase.amount_cents }]);
      await processSquareRefundEvent(refundEvent(purchase.square_payment_id));

      expect(await ticketsFor(event.id)).toHaveLength(1);
      expect(await refundState(purchase.id)).toMatchObject({ refunded_cents: 0, refunded_at: null });
    }));

  it("keeps a checked-in ticket and its check-ins on a full refund", () =>
    withFixtures(async (fixtures) => {
      const { event, purchase } = await paidTicket(fixtures);
      const [ticket] = await ticketsFor(event.id);
      await checkIn(fixtures, event.id, ticket.id);

      squareRefunds(purchase.square_payment_id, purchase.amount_cents, [{ status: "COMPLETED", cents: purchase.amount_cents }]);
      await processSquareRefundEvent(refundEvent(purchase.square_payment_id));

      expect(await ticketsFor(event.id)).toEqual([expect.objectContaining({ id: ticket.id })]);
      expect(await fetchCheckInStatuses(db, event.id)).toHaveProperty("size", 1);
      expect(await refundState(purchase.id)).toMatchObject({ refunded_cents: purchase.amount_cents });
    }));

  it("only records a partial refund", () =>
    withFixtures(async (fixtures) => {
      const { event, purchase } = await paidTicket(fixtures);

      squareRefunds(purchase.square_payment_id, purchase.amount_cents, [{ status: "COMPLETED", cents: 100 }]);
      await processSquareRefundEvent(refundEvent(purchase.square_payment_id));

      expect(await ticketsFor(event.id)).toHaveLength(1);
      expect(await refundState(purchase.id)).toMatchObject({ status: "completed", refunded_cents: 100 });
      const history = await fetchPurchasesForUser(db, (await ticketsFor(event.id))[0].user_id);
      expect(history.find((row) => row.id === purchase.id)).toMatchObject({ refunded_cents: 100 });
    }));

  it("changes nothing on a duplicate or stale delivery", () =>
    withFixtures(async (fixtures) => {
      const { event, purchase } = await paidTicket(fixtures);
      squareRefunds(purchase.square_payment_id, purchase.amount_cents, [{ status: "COMPLETED", cents: 300 }]);
      const delivery = refundEvent(purchase.square_payment_id);

      await processSquareRefundEvent(delivery);
      const first = await refundState(purchase.id);
      await processSquareRefundEvent(delivery);
      expect(await refundState(purchase.id)).toEqual(first);

      // A later event reporting less (a stale fetch) never lowers the amount.
      const { data, error } = await db.rpc("apply_event_purchase_refund", { p_purchase_id: purchase.id, p_refunded_cents: 100 });
      if (error) throw error;
      expect(data![0]).toMatchObject({ refunded_total_cents: 300, amount_increased: false, ticket_removed: false });
      expect(await refundState(purchase.id)).toEqual(first);
      expect(await ticketsFor(event.id)).toHaveLength(1);
    }));

  it("never issues a ticket when the refund lands before fulfillment", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const user = await buyer(fixtures);
      // Capture times out: the purchase stays authorized, its ticket reserved.
      square.complete.mockRejectedValue(
        new SquareError({ message: "timeout", body: { errors: [{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }] } })
      );
      const result = await executeCheckoutForUser(user, checkoutInput(event.slug));
      if (!result.ok) throw new Error("Checkout failed");
      const { data: purchase } = await db.from("purchases").select("square_payment_id, amount_cents").eq("id", result.purchaseId).single();
      const paymentId = purchase!.square_payment_id!;

      // Square captured and then refunded it in full before any payment.updated.
      squareRefunds(paymentId, purchase!.amount_cents, [{ status: "COMPLETED", cents: purchase!.amount_cents }]);
      await processSquareRefundEvent(refundEvent(paymentId));
      expect(await ticketsFor(event.id)).toEqual([]);

      await processSquarePaymentEvent({
        eventId: `it-${randomUUID()}`,
        type: "payment.updated",
        data: { object: { payment: { id: paymentId, status: "COMPLETED" } } },
      } as never);

      expect(await ticketsFor(event.id)).toEqual([]);
      expect(await refundState(result.purchaseId)).toMatchObject({ status: "completed", fulfilled_at: null, refunded_cents: purchase!.amount_cents });

      // The database refuses one too, for the race the app's check can't see.
      const { error } = await db.rpc("reserve_event_ticket", { p_event_id: event.id, p_user_id: user.id, p_purchase_id: result.purchaseId });
      expect(error).toMatchObject({ hint: "PURCHASE_REFUNDED" });
    }));

  it("records a membership refund and keeps the membership", () =>
    withFixtures(async (fixtures) => {
      const tier = await fixtures.createMembershipType();
      const user = await fixtures.createUser({ membership_type_id: tier.id });
      const { data: purchase, error } = await db
        .from("purchases")
        .insert({
          user_id: user.id, kind: "membership", membership_type_id: tier.id, status: "completed",
          amount_cents: 1000, currency: "CAD", idempotency_key: `${fixtures.tag}-${randomUUID()}`,
        })
        .select()
        .single();
      if (error) throw error;

      const applied = await db.rpc("apply_event_purchase_refund", { p_purchase_id: purchase.id, p_refunded_cents: 1000 });
      if (applied.error) throw applied.error;

      expect(applied.data![0]).toMatchObject({ fully_refunded: true, amount_increased: true, ticket_removed: false });
      expect(await refundState(purchase.id)).toMatchObject({ status: "completed", refunded_cents: 1000 });
      const { data: member } = await db.from("user_info").select("membership_type_id").eq("id", user.id).single();
      expect(member).toEqual({ membership_type_id: tier.id });
    }));
});
