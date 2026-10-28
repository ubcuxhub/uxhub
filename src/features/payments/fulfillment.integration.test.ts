/**
 * Event ticket checkout against the local database: fulfillment reserves
 * through `reserve_event_ticket` and undoes it through `release_event_ticket`.
 * Square is mocked; everything the database decides is real.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SquareError } from "square";

import type { UserInfoRow } from "@/lib/supabase/models";
import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";
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
  squareClient: { payments: square },
  getSquareLocationId: () => "location-1",
  SQUARE_CURRENCY: "CAD",
}));

const { executeCheckoutForUser, processSquarePaymentEvent } = await import(
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
    buyerFirstName: "Integration",
    buyerLastName: "Test",
    buyerEmail: "integration@example.test",
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

  it("voids the hold and leaves no ticket when the event is sold out", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", max_capacity: 1 });
      const first = await buyer(fixtures);
      const second = await buyer(fixtures);

      await executeCheckoutForUser(first, checkoutInput(event.slug));
      const result = await executeCheckoutForUser(second, checkoutInput(event.slug));

      expect(result).toEqual({ ok: false, error: "This event is sold out.", terminal: true });
      expect(square.cancel).toHaveBeenCalledTimes(1);
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

  it("sells drafts to admins and managers only", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "draft" });
      const member = await buyer(fixtures);
      const admin = await buyer(fixtures, "admin");
      const manager = await buyer(fixtures, "manager");

      await expect(
        executeCheckoutForUser(member, checkoutInput(event.slug))
      ).resolves.toEqual({ ok: false, error: "Event not found.", terminal: true });

      for (const staff of [admin, manager]) {
        await expect(
          executeCheckoutForUser(staff, checkoutInput(event.slug))
        ).resolves.toMatchObject({ ok: true, resolution: "completed" });
      }
      expect((await ticketsFor(event.id)).map((ticket) => ticket.user_id).sort()).toEqual(
        [admin.id, manager.id].sort()
      );
    }));

  it("sells an application event only on an accepted, unexpired offer", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", applications_enabled: true });
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
      expect(square.cancel).toHaveBeenCalledTimes(2);
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
