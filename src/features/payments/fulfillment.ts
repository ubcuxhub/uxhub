import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment, PaymentUpdatedEvent } from "square";
import type { PurchaseRow, UserInfoRow } from "@/lib/supabase/models";
import type { CheckoutActionResult, CheckoutRequestInput } from "./types";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { SquareRefundEvent } from "@/lib/square/webhook";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { errorFields, log } from "@/lib/log";
import {
  initializeEventCheckout,
  fetchEventTicketByPurchaseId,
  fetchUserEventTicket,
  releaseEventTicket,
  reserveEventTicket,
} from "@/lib/supabase-helpers/event-tickets";
import { fetchMembershipTypeBySlug } from "@/lib/supabase-helpers/memberships";
import {
  createPurchase,
  fetchNonterminalMembershipPurchase,
  fetchPurchaseById,
  fetchPurchaseByIdempotencyKey,
  fetchPurchaseBySquarePaymentId,
  forgetSquareWebhookEvent,
  applyPurchaseRefund,
  recordSquareWebhookEvent,
  updatePurchase,
} from "@/lib/supabase-helpers/purchases";
import { fulfillMembershipGrant } from "@/lib/supabase-helpers/membership-history";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/auth/roles";
import {
  getSquareLocationId,
  squareClient,
  SQUARE_CURRENCY,
} from "@/lib/square/client";
import {
  completedRefundCents,
  formatReservationFailure,
  getSquareErrorDiagnostic,
  getSquareErrorMessage,
  getPurchaseRedirectPath,
  isDefinitiveSquareFailure,
  matchesReferencedPurchase,
  normalizeSquareStatus,
} from "./fulfillment-rules";
import { isEligibleForMembership } from "@/features/memberships/lib/policy";
import { resolveMembershipExpiry } from "@/features/memberships/lib/expiry";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { ensureSquareCustomerId } from "./customer";
import { sendPurchaseConfirmationEmail } from "./confirmation-email";
import { revalidatePurchasePaths } from "./revalidation";
import { getExistingCheckoutResult } from "./checkout-results";
import { isFullyRefunded } from "./purchase-status";

const adminDb = supabaseAdmin as unknown as SupabaseClient<Database>;

/**
 * How long Square holds an event-ticket authorization before voiding it on its
 * own. Checkout captures within seconds, so this only matters when that
 * capture never happens (a lost response, a crashed request). Square's default
 * for card-not-present holds is seven days, which left the buyer stuck on
 * "processing" and the seat taken for a week; a short hold voids it quickly,
 * and the resulting CANCELED webhook releases the seat.
 */
const EVENT_TICKET_HOLD_DURATION = "PT10M";

async function cancelSquarePaymentIfPossible(paymentId: string) {
  try {
    await squareClient.payments.cancel({ paymentId });
  } catch {
    // Best effort only. Webhooks and purchase status reconciliation handle the rest.
  }
}
async function fulfillMembershipPurchase(purchaseId: string) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);

  if (!purchase) {
    throw new Error("Purchase not found during membership fulfillment.");
  }

  if (purchase.fulfilled_at) {
    return purchase;
  }

  if (!purchase.membership_type_id) {
    throw new Error("Membership purchase is missing a membership type.");
  }

  const termEndsAt = await fetchMembershipTermEndsAt(adminDb);
  const updatedPurchase = await fulfillMembershipGrant(
    adminDb, purchase.id, resolveMembershipExpiry(termEndsAt),
  );

  await revalidatePurchasePaths(adminDb, purchase.id);
  return updatedPurchase;
}

async function fulfillEventTicketPurchase(purchaseId: string) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);

  if (!purchase) {
    throw new Error("Purchase not found during event fulfillment.");
  }

  if (purchase.fulfilled_at) {
    return purchase;
  }

  if (!purchase.event_id) {
    throw new Error("Event ticket purchase is missing an event ID.");
  }

  // A refund recorded before the capture was confirmed means no ticket. The
  // database refuses one too (guard_refunded_purchase_ticket) for the race
  // where the refund lands after this read.
  if (isFullyRefunded(purchase)) {
    log.warn("payment.refunded_before_fulfillment", { purchaseId: purchase.id });
    return purchase;
  }

  // Checkout reserves the ticket before capturing, so it is normally there
  // already. A capture confirmed only by a later webhook may find it released
  // in between, and then reserves it again.
  const ticket = await fetchEventTicketByPurchaseId(adminDb, purchase.id);

  if (!ticket) {
    const reservation = await reserveEventTicket(adminDb, {
      eventId: purchase.event_id,
      purchaseId: purchase.id,
      userId: purchase.user_id,
    });

    if (!reservation.ticketId || reservation.failureReason) {
      throw new Error(formatReservationFailure(reservation.failureReason));
    }
  }

  const updatedPurchase = await updatePurchase(adminDb, purchase.id, {
    fulfilled_at: new Date().toISOString(),
  });

  await revalidatePurchasePaths(adminDb, purchase.id);
  return updatedPurchase;
}

async function fulfillCompletedPurchase(purchaseId: string) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);

  if (!purchase) {
    return purchase;
  }

  const fulfilled = purchase.fulfilled_at
    ? purchase
    : purchase.kind === "membership"
      ? await fulfillMembershipPurchase(purchase.id)
      : await fulfillEventTicketPurchase(purchase.id);

  // No receipt for a ticket refunded in full: it is gone or never existed.
  if (fulfilled.kind === "event_ticket" && isFullyRefunded(fulfilled)) {
    return fulfilled;
  }

  /**
   * Sent on every pass that sees a completed payment rather than only the one
   * that fulfilled it, so a send that failed earlier is retried by a later
   * webhook delivery. `confirmation_email_sent_at` keeps it to one send.
   */
  after(() => sendPurchaseConfirmationEmail(adminDb, purchase.id));

  return fulfilled;
}

async function applyPaymentStateToPurchase(purchaseId: string, payment: Payment) {
  const updatedPurchase = await updatePurchase(adminDb, purchaseId, {
    failure_reason: null,
    square_customer_id: payment.customerId ?? null,
    square_payment_id: payment.id ?? null,
    status: normalizeSquareStatus(payment.status),
  });

  if (updatedPurchase.status === "completed") {
    await fulfillCompletedPurchase(updatedPurchase.id);
  }

  // A ticket whose hold was voided or failed after its seat was reserved would
  // otherwise keep counting toward capacity and block the buyer from trying
  // again. The release only removes the ticket of a purchase that did not
  // complete, so it is a no-op when checkout already released it or never
  // reserved one.
  if (
    updatedPurchase.kind === "event_ticket" &&
    (updatedPurchase.status === "canceled" ||
      updatedPurchase.status === "failed")
  ) {
    await releaseEventTicket(adminDb, updatedPurchase.id);
  }

  return updatedPurchase;
}

async function reconcilePurchaseIfPossible(
  purchase: PurchaseRow,
): Promise<PurchaseRow> {
  if (
    !purchase.square_payment_id ||
    (purchase.status !== "pending" && purchase.status !== "authorized")
  ) {
    return purchase;
  }

  try {
    const response = await squareClient.payments.get({
      paymentId: purchase.square_payment_id,
    });

    if (response.payment) {
      return await applyPaymentStateToPurchase(purchase.id, response.payment);
    }
  } catch {
    log.error("payment.reconciliation_failed", { purchaseId: purchase.id });
  }

  return purchase;
}

async function handleExistingCheckoutAttempt(
  user: UserInfoRow,
  input: CheckoutRequestInput
): Promise<CheckoutActionResult | null> {
  const existingPurchase = await fetchPurchaseByIdempotencyKey(
    adminDb,
    input.idempotencyKey
  );

  if (!existingPurchase) {
    return null;
  }

  if (existingPurchase.user_id !== user.id) {
    return getExistingCheckoutResult(existingPurchase, user.id);
  }

  if (existingPurchase.kind !== input.kind) {
    return { ok: false, error: formatReservationFailure("ATTEMPT_MISMATCH"), terminal: true };
  }
  if (input.kind === "event_ticket") {
    const event = await fetchEventBySlug(adminDb, input.slug);
    if (!event || event.id !== existingPurchase.event_id) {
      return { ok: false, error: formatReservationFailure("ATTEMPT_MISMATCH"), terminal: true };
    }
  }
  const reconciledPurchase = await reconcilePurchaseIfPossible(existingPurchase);

  if (reconciledPurchase.status === "completed") {
    await fulfillCompletedPurchase(reconciledPurchase.id);
  }

  return getExistingCheckoutResult(reconciledPurchase, user.id);
}

async function createSquarePaymentForMembership(
  user: UserInfoRow,
  input: CheckoutRequestInput
) {
  const membershipType = await fetchMembershipTypeBySlug(adminDb, input.slug);

  if (!membershipType) {
    return { error: "Membership plan not found.", terminal: true } as const;
  }

  const termEndsAt = await fetchMembershipTermEndsAt(adminDb);

  if (!isEligibleForMembership(user, membershipType, termEndsAt)) {
    return {
      error: "This membership tier is not available for your account.",
      terminal: true,
    } as const;
  }

  const nonterminalPurchase = await fetchNonterminalMembershipPurchase(
    adminDb,
    user.id,
    membershipType.id,
  );

  if (nonterminalPurchase) {
    const reconciledPurchase =
      await reconcilePurchaseIfPossible(nonterminalPurchase);
    const existingResult = getExistingCheckoutResult(
      reconciledPurchase,
      user.id,
    );

    return existingResult.ok
      ? {
          purchaseId: existingResult.purchaseId,
          resolution: existingResult.resolution,
        } as const
      : {
          error: existingResult.error,
          terminal: existingResult.terminal,
        } as const;
  }

  const customerId = await ensureSquareCustomerId(user, input);

  const purchase = await createPurchase(adminDb, {
    amount_cents: Math.round(membershipType.price * 100),
    currency: SQUARE_CURRENCY,
    idempotency_key: input.idempotencyKey,
    kind: "membership",
    membership_type_id: membershipType.id,
    square_customer_id: customerId,
    status: "pending",
    user_id: user.id,
  });

  try {
    const paymentResponse = await squareClient.payments.create({
      amountMoney: {
        amount: BigInt(purchase.amount_cents),
        currency: SQUARE_CURRENCY,
      },
      autocomplete: true,
      buyerEmailAddress: input.buyerEmail,
      customerId,
      idempotencyKey: purchase.idempotency_key,
      locationId: getSquareLocationId(),
      note: `UX Hub membership purchase: ${membershipType.name}`,
      referenceId: purchase.id,
      sourceId: input.token!,
      verificationToken: input.verificationToken ?? undefined,
    });

    const payment = paymentResponse.payment;

    if (!payment?.id) {
      throw new Error("Square did not return a payment ID.");
    }

    const updatedPurchase = await applyPaymentStateToPurchase(purchase.id, payment);

    return {
      purchaseId: purchase.id,
      resolution:
        updatedPurchase.status === "completed" ? "completed" : "processing",
    } as const;
  } catch (error) {
    const chargeFields = {
      purchaseId: purchase.id,
      diagnostic: getSquareErrorDiagnostic(error),
    };

    // A decline is the buyer's card, not a bug, so it stays out of Sentry.
    if (isDefinitiveSquareFailure(error)) {
      log.warn("payment.membership_charge_declined", chargeFields);
    } else {
      log.error("payment.membership_charge_failed", chargeFields);
    }

    if (isDefinitiveSquareFailure(error)) {
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: getSquareErrorMessage(error),
        status: "failed",
      });

      return {
        error: getSquareErrorMessage(error),
        terminal: true,
      } as const;
    }

    return {
      purchaseId: purchase.id,
      resolution: "processing",
    } as const;
  }
}

async function checkoutEventTicket(
  user: UserInfoRow,
  input: CheckoutRequestInput
) {
  // The service-role client sees drafts too, so only admins and managers may
  // reach one, to test it (docs/event-states.md, "Drafts for admins").
  // reserve_event_ticket checks the same, along with applications and offers.
  const event = await fetchEventBySlug(
    adminDb,
    input.slug,
    hasAdminAccess(user.role_access) ? {} : { status: "active" },
  );

  if (!event) {
    return { error: "Event not found.", terminal: true } as const;
  }

  const existingTicket = await fetchUserEventTicket(adminDb, event.id, user.id);

  if (existingTicket) {
    const retry = await handleExistingCheckoutAttempt(user, input);
    if (retry?.ok) return { purchaseId: retry.purchaseId, resolution: retry.resolution } as const;
    return {
      error: formatReservationFailure("ALREADY_REGISTERED"),
      terminal: true,
    } as const;
  }

  const initialized = await initializeEventCheckout(adminDb, {
    eventId: event.id,
    userId: user.id,
    idempotencyKey: input.idempotencyKey,
    freeOnly: !input.token,
    expectedAmountCents: input.expectedAmountCents,
  });
  if (initialized.failure_reason || !initialized.purchase_id) {
    // Refused before any purchase or Square call, so no card was held.
    log.warn("payment.ticket_checkout_refused", { eventId: event.id, reason: initialized.failure_reason ?? null });
    return { error: formatReservationFailure(initialized.failure_reason), terminal: true } as const;
  }
  const purchase = await fetchPurchaseById(adminDb, initialized.purchase_id);
  if (!purchase) throw new Error("Initialized purchase not found.");
  if (purchase.status !== "pending") {
    if (purchase.status === "completed") await fulfillCompletedPurchase(purchase.id);
    const existing = getExistingCheckoutResult(purchase, user.id);
    if (!existing.ok) return { error: existing.error, terminal: existing.terminal } as const;
    await revalidatePurchasePaths(adminDb, purchase.id);
    return { purchaseId: existing.purchaseId, resolution: existing.resolution } as const;
  }
  // Only the transaction that created a paid attempt may start its external
  // payment. Concurrent requests observe processing, avoiding competing card
  // tokens/customer failures for the same durable snapshot.
  if (!initialized.created) return { purchaseId: purchase.id, resolution: "processing" } as const;
  if (purchase.amount_cents === 0) throw new Error("Free registration was not committed atomically.");

  // The database snapshot locks pricing before any external payment request.
  // Free registration never creates a Square customer or touches a card.
  let customerId: string;
  try {
    customerId = await ensureSquareCustomerId(user, input);
  } catch (error) {
    log.error("payment.ticket_customer_failed", { purchaseId: purchase.id, ...errorFields(error) });
    await updatePurchase(adminDb, purchase.id, { status: "failed", failure_reason: "Payment could not be initialized. Please try again." });
    return { error: "Payment could not be initialized. Please try again.", terminal: true } as const;
  }

  try {
    const paymentResponse = await squareClient.payments.create({
      amountMoney: {
        amount: BigInt(purchase.amount_cents),
        currency: SQUARE_CURRENCY,
      },
      autocomplete: false,
      buyerEmailAddress: input.buyerEmail,
      customerId,
      delayAction: "CANCEL",
      delayDuration: EVENT_TICKET_HOLD_DURATION,
      idempotencyKey: purchase.idempotency_key,
      locationId: getSquareLocationId(),
      note: `UX Hub event ticket: ${event.name}`,
      referenceId: purchase.id,
      sourceId: input.token!,
      verificationToken: input.verificationToken ?? undefined,
    });

    const payment = paymentResponse.payment;

    if (!payment?.id) {
      throw new Error("Square did not return a payment ID.");
    }

    await updatePurchase(adminDb, purchase.id, {
      square_customer_id: payment.customerId ?? customerId,
      square_payment_id: payment.id,
      status: normalizeSquareStatus(payment.status),
    });

    const reservation = await reserveEventTicket(adminDb, {
      eventId: event.id,
      purchaseId: purchase.id,
      userId: user.id,
    });

    if (!reservation.ticketId || reservation.failureReason) {
      await cancelSquarePaymentIfPossible(payment.id);
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: formatReservationFailure(reservation.failureReason),
        status: "canceled",
      });

      return {
        error: formatReservationFailure(reservation.failureReason),
        terminal: true,
      } as const;
    }

    const captureResponse = await squareClient.payments.complete({
      paymentId: payment.id,
    });
    const capturedPayment = captureResponse.payment;

    if (!capturedPayment?.id) {
      throw new Error("Square did not return the completed payment.");
    }

    const updatedPurchase = await applyPaymentStateToPurchase(
      purchase.id,
      capturedPayment,
    );

    return {
      purchaseId: purchase.id,
      resolution:
        updatedPurchase.status === "completed" ? "completed" : "processing",
    } as const;
  } catch (error) {
    const chargeFields = {
      purchaseId: purchase.id,
      diagnostic: getSquareErrorDiagnostic(error),
    };

    // A decline is the buyer's card, not a bug, so it stays out of Sentry.
    if (isDefinitiveSquareFailure(error)) {
      log.warn("payment.ticket_charge_declined", chargeFields);
    } else {
      log.error("payment.ticket_charge_failed", chargeFields);
    }

    const purchaseRecord = await fetchPurchaseById(adminDb, purchase.id);
    const paymentId = purchaseRecord?.square_payment_id ?? null;

    if (paymentId && isDefinitiveSquareFailure(error)) {
      await cancelSquarePaymentIfPossible(paymentId);
    }

    if (isDefinitiveSquareFailure(error)) {
      await releaseEventTicket(adminDb, purchase.id).catch(() => undefined);
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: getSquareErrorMessage(error),
        status: "failed",
      });

      return {
        error: getSquareErrorMessage(error),
        terminal: true,
      } as const;
    }

    return {
      purchaseId: purchase.id,
      resolution: "processing",
    } as const;
  }
}

export async function executeCheckoutForUser(
  user: UserInfoRow,
  input: CheckoutRequestInput
): Promise<CheckoutActionResult> {
  const existingAttempt = await handleExistingCheckoutAttempt(
    user,
    input
  );

  if (existingAttempt) {
    return existingAttempt;
  }

  const result =
    input.kind === "membership"
      ? await createSquarePaymentForMembership(user, input)
      : await checkoutEventTicket(user, input);

  if ("error" in result && result.error) {
    return {
      ok: false,
      error: result.error,
      terminal: result.terminal,
    };
  }

  if (!("purchaseId" in result) || !result.purchaseId) {
    return {
      ok: false,
      error: "Checkout finished without a purchase record.",
      terminal: false,
    };
  }

  return {
    ok: true,
    purchaseId: result.purchaseId,
    redirectTo: getPurchaseRedirectPath(),
    resolution: result.resolution,
  };
}

export async function processSquarePaymentEvent(
  event: PaymentUpdatedEvent,
  rawPayload: NonNullable<Json> = event as NonNullable<Json>
) {
  const eventId = event.eventId;
  const eventType = event.type;
  const payment = event.data?.object?.payment;

  if (!eventId || !eventType || !payment?.id) {
    return;
  }

  await processOnce(eventId, eventType, rawPayload, () =>
    applySquarePayment(payment.id!, payment)
  );
}

/**
 * Handles a `refund.created` or `refund.updated` delivery. The payload's
 * refund only names the payment: the payment and each of its refunds are
 * fetched from Square, so a delivery that arrives late or out of order still
 * records the current total of completed refunds.
 */
export async function processSquareRefundEvent(
  event: SquareRefundEvent,
  rawPayload: NonNullable<Json> = event as NonNullable<Json>
) {
  const eventId = event.eventId;
  const eventType = event.type;
  const paymentId = event.data?.object?.refund?.paymentId;

  if (!eventId || !eventType || !paymentId) {
    return;
  }

  await processOnce(eventId, eventType, rawPayload, async () => {
    const { payment } = await squareClient.payments.get({ paymentId });
    if (!payment?.id) {
      throw new Error("Square did not return the refunded payment.");
    }
    const purchase = await findPurchaseForPayment(payment.id, payment);
    if (purchase) await syncPurchaseRefunds(purchase, payment);
  });
}

/**
 * Runs `handle` for a webhook event unless another delivery of it already
 * ran. The event is recorded before processing so concurrent deliveries are
 * handled once, and forgotten again on failure, or Square's retry would be
 * dropped as a duplicate and the purchase would never settle.
 */
async function processOnce(
  eventId: string,
  eventType: string,
  rawPayload: NonNullable<Json>,
  handle: () => Promise<void>
) {
  const wasRecorded = await recordSquareWebhookEvent(adminDb, {
    event_id: eventId,
    event_type: eventType,
    payload: rawPayload,
  });

  if (!wasRecorded) {
    return;
  }

  try {
    await handle();
  } catch (error) {
    await forgetSquareWebhookEvent(adminDb, eventId).catch((forgetError) => {
      log.error("webhook.square_event_forget_failed", {
        eventId,
        ...errorFields(forgetError),
      });
    });
    throw error;
  }
}

/**
 * Records the payment's completed refunds on its purchase. A full refund of
 * an event ticket takes the ticket back, unless it was checked in
 * (docs/event-states.md, "Refunds").
 */
async function syncPurchaseRefunds(purchase: PurchaseRow, payment: Payment) {
  const refunds = await Promise.all(
    (payment.refundIds ?? []).map(
      async (refundId) => (await squareClient.refunds.get({ refundId })).refund
    )
  );
  const refundedCents = completedRefundCents(payment, refunds);
  if (refundedCents <= purchase.refunded_cents && !isFullyRefunded(purchase)) return;

  const result = await applyPurchaseRefund(adminDb, purchase.id, refundedCents);
  if (!result) return;

  const fields = {
    purchaseId: purchase.id,
    refundedCents: result.refundedCents,
    fullyRefunded: result.fullyRefunded,
  };
  if (result.keptCheckedInTicket && result.amountIncreased) {
    // The money went back after the door: someone should decide whether that
    // was right, so it is a warning, not just a record.
    log.warn("payment.refund_after_check_in", fields);
  } else if (purchase.kind === "membership" && result.amountIncreased) {
    // Refunding a membership does not end it; an admin does that by hand.
    log.warn("payment.membership_refunded", fields);
  } else if (result.amountIncreased || result.ticketRemoved) {
    log.info("payment.refund_recorded", { ...fields, ticketRemoved: result.ticketRemoved });
  }

  if (result.amountIncreased || result.ticketRemoved) {
    await revalidatePurchasePaths(adminDb, purchase.id);
  }
}

async function findPurchaseForPayment(
  paymentId: string,
  payment: Payment
): Promise<PurchaseRow | null> {
  let purchase = await fetchPurchaseBySquarePaymentId(adminDb, paymentId);

  // A create-payment response can be lost after Square accepts the charge but
  // before we persist its payment ID. Square echoes our purchase ID as the
  // reference ID, so a signed webhook can safely repair that ambiguous state.
  if (!purchase && payment.referenceId) {
    const candidate = await fetchPurchaseById(adminDb, payment.referenceId);
    if (matchesReferencedPurchase(payment, candidate)) {
      purchase = candidate;
    }
  }

  return purchase;
}

async function applySquarePayment(paymentId: string, payment: Payment) {
  const purchase = await findPurchaseForPayment(paymentId, payment);
  if (!purchase) return;

  const updated = await applyPaymentStateToPurchase(purchase.id, payment);

  // Square also sends payment.updated when a refund completes, so a missed or
  // reordered refund event still lands here.
  if (payment.refundIds?.length) {
    await syncPurchaseRefunds(updated, payment);
  }
}
