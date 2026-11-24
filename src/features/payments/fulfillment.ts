import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment, PaymentUpdatedEvent } from "square";
import type { PurchaseRow, UserInfoRow } from "@/lib/supabase/models";
import type { CheckoutActionResult, CheckoutRequestInput } from "./types";
import type { Database } from "@/lib/supabase/database.types";
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
  applySquarePaymentStatus,
  claimSquareWebhookEvent,
  createPurchase,
  failAbandonedPurchase,
  fetchLiveMembershipPurchase,
  fetchPurchaseById,
  fetchPurchaseByIdempotencyKey,
  fetchPurchaseBySquarePaymentId,
  forgetSquareWebhookEvent,
  applyPurchaseRefund,
  isUniqueViolation,
  markPurchaseFulfilled,
  markSquareWebhookEventProcessed,
  updatePurchase,
} from "@/lib/supabase-helpers/purchases";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/auth/roles";
import {
  getSquareLocationId,
  squareClient,
  SQUARE_CURRENCY,
} from "@/lib/square/client";
import {
  ABANDONED_PURCHASE_AFTER_MS,
  ABANDONED_PURCHASE_REASON,
  completedRefundCents,
  emailableRefunds,
  formatReservationFailure,
  FREE_MEMBERSHIP_UNAVAILABLE,
  getRejectedPaymentMessage,
  getSquareErrorDiagnostic,
  isDefinitiveSquareFailure,
  isRejectedSquareRequest,
  matchesReferencedPurchase,
  MEMBERSHIP_PRICE_CHANGED,
  MEMBERSHIP_PURCHASE_IN_PROGRESS,
  normalizeSquareStatus,
} from "./fulfillment-rules";
import { isEligibleForMembership } from "@/features/memberships/lib/policy";
import { resolveMembershipExpiry } from "@/features/memberships/lib/expiry";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { ensureSquareCustomerId } from "./customer";
import { sendPurchaseConfirmationEmail } from "./confirmation-email";
import { sendRefundIssuedEmail } from "./refund-email";
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

  // Grant first and stamp `fulfilled_at` last: every retry (a webhook
  // redelivery, a checkout reconciliation) skips a stamped purchase, so a
  // stamp written before a grant that then failed would lose the membership
  // for good. Granting again is harmless: the expiry is measured from the
  // purchase, so a retry writes the same values.
  const termEndsAt = await fetchMembershipTermEndsAt(adminDb);
  const purchasedAt = purchase.created_at ? new Date(purchase.created_at) : undefined;

  await updateUserInfoById(adminDb, purchase.user_id, {
    membership_expires_at: resolveMembershipExpiry(termEndsAt, purchasedAt),
    membership_pre_ordered_type_id: null,
    membership_type_id: purchase.membership_type_id,
    ...(purchase.square_customer_id
      ? { square_customer_id: purchase.square_customer_id }
      : {}),
  });

  const updatedPurchase = await markPurchaseFulfilled(adminDb, purchase.id);

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

  const updatedPurchase = await markPurchaseFulfilled(adminDb, purchase.id);

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
  const status = normalizeSquareStatus(payment.status);
  const { purchase: updatedPurchase, applied } = await applySquarePaymentStatus(
    adminDb,
    purchaseId,
    {
      status,
      squareCustomerId: payment.customerId ?? null,
      squarePaymentId: payment.id ?? null,
    },
  );

  // An older payload delivered after a newer one: Square doesn't promise
  // order, and a completed purchase must never go back to authorized.
  if (!applied) {
    log.info("payment.stale_status_ignored", {
      purchaseId,
      status,
      currentStatus: updatedPurchase.status,
    });
  }

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

/**
 * Fails a purchase pending with no Square payment ID once it is old enough
 * to be abandoned (see ABANDONED_PURCHASE_AFTER_MS), so the buyer can try
 * again. pg_cron does the same on a schedule (`fail_abandoned_purchases`);
 * this settles it the moment the buyer comes back.
 */
async function failPurchaseIfAbandoned(
  purchase: PurchaseRow,
  now = Date.now(),
): Promise<PurchaseRow> {
  if (purchase.status !== "pending" || purchase.square_payment_id) {
    return purchase;
  }

  const cutoff = now - ABANDONED_PURCHASE_AFTER_MS;
  const createdAt = purchase.created_at ? Date.parse(purchase.created_at) : Number.NaN;
  if (!Number.isFinite(createdAt) || createdAt >= cutoff) {
    return purchase;
  }
  const createdBefore = new Date(cutoff).toISOString();

  const failed = await failAbandonedPurchase(
    adminDb,
    purchase.id,
    createdBefore,
    ABANDONED_PURCHASE_REASON,
  );
  if (!failed) return (await fetchPurchaseById(adminDb, purchase.id)) ?? purchase;

  log.warn("payment.abandoned_purchase_failed", { purchaseId: purchase.id });
  return failed;
}

async function reconcilePurchaseIfPossible(
  purchase: PurchaseRow,
): Promise<PurchaseRow> {
  if (!purchase.square_payment_id) {
    return await failPurchaseIfAbandoned(purchase);
  }

  if (purchase.status !== "pending" && purchase.status !== "authorized") {
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

type MembershipCheckoutOutcome =
  | { purchaseId: string; resolution: "completed" | "processing" }
  | { error: string; terminal: boolean };

function toOutcome(result: CheckoutActionResult): MembershipCheckoutOutcome {
  return result.ok
    ? { purchaseId: result.purchaseId, resolution: result.resolution }
    : { error: result.error, terminal: result.terminal };
}

/**
 * The user's membership purchase still in flight, settled with Square first
 * (or failed, if it was abandoned). Null when none is left live: the user is
 * free to buy.
 */
async function settleLiveMembershipPurchase(userId: string) {
  const live = await fetchLiveMembershipPurchase(adminDb, userId);
  if (!live) return null;

  const settled = await reconcilePurchaseIfPossible(live);
  return settled.status === "failed" || settled.status === "canceled"
    ? null
    : settled;
}

/**
 * What a new checkout for `membershipTypeId` answers while another purchase
 * of the user's is live or just completed: that purchase's own result for the
 * same tier, otherwise a refusal (only one membership is bought at a time).
 */
function existingMembershipOutcome(
  purchase: PurchaseRow,
  membershipTypeId: string,
  userId: string,
): MembershipCheckoutOutcome {
  if (purchase.membership_type_id === membershipTypeId) {
    return toOutcome(getExistingCheckoutResult(purchase, userId));
  }

  return purchase.status === "completed"
    ? { error: "This membership tier is not available for your account.", terminal: true }
    : { error: MEMBERSHIP_PURCHASE_IN_PROGRESS, terminal: true };
}

async function createSquarePaymentForMembership(
  user: UserInfoRow,
  input: CheckoutRequestInput
): Promise<MembershipCheckoutOutcome> {
  const membershipType = await fetchMembershipTypeBySlug(adminDb, input.slug);

  if (!membershipType) {
    return { error: "Membership plan not found.", terminal: true };
  }

  // A purchase already in flight, for this tier or another, settles before
  // anything new is charged. `purchases_one_live_membership_per_user` backs
  // this up for two checkouts racing past it.
  const live = await settleLiveMembershipPurchase(user.id);

  if (live) {
    if (live.status === "completed") await fulfillCompletedPurchase(live.id);
    return existingMembershipOutcome(live, membershipType.id, user.id);
  }

  const termEndsAt = await fetchMembershipTermEndsAt(adminDb);

  if (!isEligibleForMembership(user, membershipType, termEndsAt)) {
    return {
      error: "This membership tier is not available for your account.",
      terminal: true,
    };
  }

  // The buyer verified (and their bank may have challenged) this amount.
  // A price changed in Club Settings since checkout loaded is refused, not
  // charged.
  const amountCents = Math.round(membershipType.price * 100);

  if (input.expectedAmountCents !== amountCents) {
    log.warn("payment.membership_price_changed", { membershipTypeId: membershipType.id });
    return { error: MEMBERSHIP_PRICE_CHANGED, terminal: true };
  }

  if (amountCents === 0) {
    return await grantFreeMembership(user, input, membershipType.id);
  }

  if (!input.token) {
    return { error: "Enter your card details to pay.", terminal: true };
  }

  const customerId = await ensureSquareCustomerId(user);

  let purchase: PurchaseRow;
  try {
    purchase = await createPurchase(adminDb, {
      amount_cents: amountCents,
      currency: SQUARE_CURRENCY,
      idempotency_key: input.idempotencyKey,
      kind: "membership",
      membership_type_id: membershipType.id,
      square_customer_id: customerId,
      status: "pending",
      user_id: user.id,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return await racedMembershipOutcome(user.id, input, membershipType.id);
  }

  try {
    const paymentResponse = await squareClient.payments.create({
      amountMoney: {
        amount: BigInt(purchase.amount_cents),
        currency: SQUARE_CURRENCY,
      },
      autocomplete: true,
      buyerEmailAddress: user.email,
      customerId,
      idempotencyKey: purchase.idempotency_key,
      locationId: getSquareLocationId(),
      note: `UX Hub membership purchase: ${membershipType.name}`,
      referenceId: purchase.id,
      sourceId: input.token,
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
    };
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

    // The create call failed, so the purchase has no payment ID: a request
    // Square refused created nothing, and the attempt is over.
    if (isDefinitiveSquareFailure(error) || isRejectedSquareRequest(error)) {
      const message = getRejectedPaymentMessage(error);
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: message,
        status: "failed",
      });

      return { error: message, terminal: true };
    }

    return {
      purchaseId: purchase.id,
      resolution: "processing",
    };
  }
}

/**
 * Another request inserted first: the same attempt submitted twice (its
 * idempotency key), or a second checkout while one was live (the one-live
 * index). Either way, answer with the purchase that won.
 */
async function racedMembershipOutcome(
  userId: string,
  input: CheckoutRequestInput,
  membershipTypeId: string,
): Promise<MembershipCheckoutOutcome> {
  const sameAttempt = await fetchPurchaseByIdempotencyKey(adminDb, input.idempotencyKey);
  if (sameAttempt) return toOutcome(getExistingCheckoutResult(sameAttempt, userId));

  const live = await fetchLiveMembershipPurchase(adminDb, userId);
  if (live) return existingMembershipOutcome(live, membershipTypeId, userId);

  // The winner settled already; this attempt charged nothing.
  return { error: MEMBERSHIP_PURCHASE_IN_PROGRESS, terminal: true };
}

/**
 * A $0 tier (Club Settings allows one): recorded as a completed purchase and
 * granted at once, with no card and no Square call, like a free event ticket.
 */
async function grantFreeMembership(
  user: UserInfoRow,
  input: CheckoutRequestInput,
  membershipTypeId: string,
): Promise<MembershipCheckoutOutcome> {
  let purchase: PurchaseRow;
  try {
    purchase = await createPurchase(adminDb, {
      amount_cents: 0,
      currency: SQUARE_CURRENCY,
      idempotency_key: input.idempotencyKey,
      kind: "membership",
      membership_type_id: membershipTypeId,
      status: "completed",
      user_id: user.id,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await fetchPurchaseByIdempotencyKey(adminDb, input.idempotencyKey);
    if (!existing) return { error: FREE_MEMBERSHIP_UNAVAILABLE, terminal: true };
    return toOutcome(getExistingCheckoutResult(existing, user.id));
  }

  await fulfillCompletedPurchase(purchase.id);
  return { purchaseId: purchase.id, resolution: "completed" };
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
    customerId = await ensureSquareCustomerId(user);
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
      buyerEmailAddress: user.email,
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

    // A decline is final wherever it happened. A refused request is final
    // only before a payment exists: one refused later (the capture) says
    // nothing about whether money moved, so the webhook settles that.
    const attemptOver =
      isDefinitiveSquareFailure(error) ||
      (!paymentId && isRejectedSquareRequest(error));

    if (paymentId && attemptOver) {
      await cancelSquarePaymentIfPossible(paymentId);
    }

    if (attemptOver) {
      const message = getRejectedPaymentMessage(error);
      await releaseEventTicket(adminDb, purchase.id).catch(() => undefined);
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: message,
        status: "failed",
      });

      return {
        error: message,
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
    resolution: result.resolution,
  };
}

/**
 * Thrown when another delivery of the same webhook event is still being
 * handled. The route answers it with a retryable status, so Square sends the
 * event again later instead of treating this delivery as done.
 */
export class SquareWebhookInProgressError extends Error {
  override name = "SquareWebhookInProgressError";

  constructor() {
    super("Another delivery of this Square event is still being processed.");
  }
}

/**
 * `origin` is the site Square delivered the webhook to, for links in the
 * emails it may send; null leaves the links out.
 */
export async function processSquarePaymentEvent(
  event: PaymentUpdatedEvent,
  origin: string | null = null
) {
  const eventId = event.eventId;
  const eventType = event.type;
  const payment = event.data?.object?.payment;

  if (!eventId || !eventType || !payment?.id) {
    return;
  }

  await processOnce(eventId, eventType, payment.id, () =>
    applySquarePayment(payment.id!, payment, origin)
  );
}

/**
 * Handles a `refund.created` or `refund.updated` delivery. The payload's
 * refund only names the payment: the payment and each of its refunds are
 * fetched from Square, so a delivery that arrives late or out of order still
 * records the current total of completed refunds. `origin` is as for
 * `processSquarePaymentEvent`.
 */
export async function processSquareRefundEvent(
  event: SquareRefundEvent,
  origin: string | null = null
) {
  const eventId = event.eventId;
  const eventType = event.type;
  const paymentId = event.data?.object?.refund?.paymentId;

  if (!eventId || !eventType || !paymentId) {
    return;
  }

  await processOnce(eventId, eventType, paymentId, async () => {
    const { payment } = await squareClient.payments.get({ paymentId });
    if (!payment?.id) {
      throw new Error("Square did not return the refunded payment.");
    }
    const purchase = await findPurchaseForPayment(payment.id, payment);
    if (purchase) await syncPurchaseRefunds(purchase, payment, origin);
  });
}

/**
 * Runs `handle` for a webhook event unless another delivery of it already
 * ran. The event is claimed before processing so concurrent deliveries are
 * handled once, stamped processed after, and forgotten again on failure, or
 * Square's retry would be dropped as a duplicate and the purchase would never
 * settle. A delivery that finds the event claimed but not yet processed
 * throws `SquareWebhookInProgressError`, so Square keeps retrying it until
 * the first one finishes (or its claim goes stale and is taken over).
 */
async function processOnce(
  eventId: string,
  eventType: string,
  squarePaymentId: string,
  handle: () => Promise<void>
) {
  const claim = await claimSquareWebhookEvent(adminDb, {
    event_id: eventId,
    event_type: eventType,
    square_payment_id: squarePaymentId,
  });

  if (claim === "processed") return;
  if (claim === "in_progress") throw new SquareWebhookInProgressError();

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

  // The work is done, so this delivery succeeded either way. An unstamped
  // claim only makes a duplicate wait for it to go stale, then run again,
  // which every handler tolerates.
  await markSquareWebhookEventProcessed(adminDb, eventId).catch((markError) => {
    log.error("webhook.square_event_mark_failed", {
      eventId,
      ...errorFields(markError),
    });
  });
}

/**
 * Records the payment's completed refunds on its purchase, then emails the
 * buyer about each one. A full refund of an event ticket takes the ticket
 * back, unless it was checked in (docs/event-states.md, "Refunds"). Refunds
 * are issued in Square, never in the app, so every one reaches the app here.
 */
async function syncPurchaseRefunds(
  purchase: PurchaseRow,
  payment: Payment,
  origin: string | null
) {
  const refunds = await Promise.all(
    (payment.refundIds ?? []).map(
      async (refundId) => (await squareClient.refunds.get({ refundId })).refund
    )
  );
  const refundedCents = completedRefundCents(payment, refunds);
  if (refundedCents > purchase.refunded_cents || isFullyRefunded(purchase)) {
    const known = await recordPurchaseRefunds(purchase, refundedCents);
    if (!known) return;
  }

  /**
   * Scheduled on every pass that sees a completed refund, not only the one
   * that recorded it, so a send that failed earlier is retried by a later
   * delivery; the claim on each refund's row keeps it to one send. It runs
   * after the response, when the refund recorded above is committed. While
   * Square's own refunded total lags its refund list, the amount recorded is
   * short of the refunds, so the emails wait for the delivery that catches up.
   */
  const recordedInFull =
    refundedCents >= completedRefundCents({ amountMoney: payment.amountMoney }, refunds);
  const toEmail = recordedInFull ? emailableRefunds(payment, refunds) : [];
  if (toEmail.length > 0) {
    after(async () => {
      for (const refund of toEmail) {
        await sendRefundIssuedEmail(adminDb, purchase.id, refund, origin);
      }
    });
  }
}

/** False for an unknown purchase. */
async function recordPurchaseRefunds(purchase: PurchaseRow, refundedCents: number) {
  const result = await applyPurchaseRefund(adminDb, purchase.id, refundedCents);
  if (!result) return false;

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
  return true;
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

async function applySquarePayment(
  paymentId: string,
  payment: Payment,
  origin: string | null
) {
  const purchase = await findPurchaseForPayment(paymentId, payment);
  if (!purchase) return;

  const updated = await applyPaymentStateToPurchase(purchase.id, payment);

  // Square also sends payment.updated when a refund completes, so a missed or
  // reordered refund event still lands here.
  if (payment.refundIds?.length) {
    await syncPurchaseRefunds(updated, payment, origin);
  }
}
