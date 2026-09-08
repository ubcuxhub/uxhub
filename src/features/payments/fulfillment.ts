import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment, PaymentUpdatedEvent } from "square";
import type { PurchaseRow, UserInfoRow } from "@/types/models";
import type { CheckoutActionResult, CheckoutRequestInput } from "./types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventRegistrationByPurchaseId,
  fetchUserRegistration,
  updateEventRegistration,
} from "@/lib/supabase-helpers/event-registrations";
import { fetchMembershipTypeBySlug } from "@/lib/supabase-helpers/memberships";
import {
  createPurchase,
  fetchNonterminalMembershipPurchase,
  fetchPurchaseById,
  fetchPurchaseByIdempotencyKey,
  fetchPurchaseBySquarePaymentId,
  recordSquareWebhookEvent,
  updatePurchase,
} from "@/lib/supabase-helpers/purchases";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getSquareLocationId,
  squareClient,
  SQUARE_CURRENCY,
} from "@/lib/square/client";
import {
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

const adminDb = supabaseAdmin as unknown as SupabaseClient<Database>;

async function cancelSquarePaymentIfPossible(paymentId: string) {
  try {
    await squareClient.payments.cancel({ paymentId });
  } catch {
    // Best effort only. Webhooks and purchase status reconciliation handle the rest.
  }
}
async function reserveEventTicketSeat(
  eventId: string,
  userId: string,
  purchaseId: string
) {
  const { data, error } = await adminDb.rpc("reserve_paid_event_ticket", {
    p_event_id: eventId,
    p_purchase_id: purchaseId,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function releaseEventTicketSeatReservation(purchaseId: string) {
  const { error } = await adminDb.rpc("release_paid_event_ticket_reservation", {
    p_purchase_id: purchaseId,
  });

  if (error) {
    throw error;
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

  const updatedPurchase = await updatePurchase(adminDb, purchase.id, {
    fulfilled_at: new Date().toISOString(),
  });

  const termEndsAt = await fetchMembershipTermEndsAt(adminDb);

  await updateUserInfoById(adminDb, purchase.user_id, {
    membership_expires_at: resolveMembershipExpiry(termEndsAt),
    membership_pre_ordered_type_id: null,
    membership_type_id: purchase.membership_type_id,
    square_customer_id: purchase.square_customer_id,
  });

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

  let registration = await fetchEventRegistrationByPurchaseId(adminDb, purchase.id);

  if (!registration) {
    const reservation = await reserveEventTicketSeat(
      purchase.event_id,
      purchase.user_id,
      purchase.id
    );

    if (!reservation?.registration_id || reservation.failure_reason) {
      throw new Error(
        formatReservationFailure(reservation?.failure_reason ?? null)
      );
    }

    registration = await fetchEventRegistrationByPurchaseId(adminDb, purchase.id);
  }

  if (!registration) {
    throw new Error("Reserved event registration could not be loaded.");
  }

  await updateEventRegistration(adminDb, registration.id, {
    attending: true,
    purchase_id: purchase.id,
    status: "accepted",
  });

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
    console.error(
      `Square payment reconciliation failed for purchase ${purchase.id}.`,
    );
  }

  return purchase;
}

async function handleExistingCheckoutAttempt(
  user: UserInfoRow,
  idempotencyKey: string
): Promise<CheckoutActionResult | null> {
  const existingPurchase = await fetchPurchaseByIdempotencyKey(
    adminDb,
    idempotencyKey
  );

  if (!existingPurchase) {
    return null;
  }

  if (existingPurchase.user_id !== user.id) {
    return getExistingCheckoutResult(existingPurchase, user.id);
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
    } as const;
  } catch (error) {
    console.error(
      `Square membership payment failed for purchase ${purchase.id}:`,
      getSquareErrorDiagnostic(error)
    );

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

async function createSquarePaymentForEventTicket(
  user: UserInfoRow,
  input: CheckoutRequestInput
) {
  const event = await fetchEventBySlug(adminDb, input.slug, {
    status: "active",
  });

  if (!event) {
    return { error: "Event not found.", terminal: true } as const;
  }

  const applicationQuestions = event.applications_enabled
    ? await fetchApplicationQuestions(adminDb, event.id)
    : [];

  if (applicationQuestions.length > 0) {
    return {
      error:
        "This event uses an application flow and cannot be purchased directly.",
      terminal: true,
    } as const;
  }

  const existingRegistration = await fetchUserRegistration(adminDb, event.id, user.id);

  if (existingRegistration) {
    return {
      error: "You already have a registration for this event.",
      terminal: true,
    } as const;
  }

  const customerId = await ensureSquareCustomerId(user, input);
  const amountCents = Math.round(
    (user.membership_type_id ? event.member_price : event.regular_price) * 100
  );

  const purchase = await createPurchase(adminDb, {
    amount_cents: amountCents,
    currency: SQUARE_CURRENCY,
    event_id: event.id,
    idempotency_key: input.idempotencyKey,
    kind: "event_ticket",
    square_customer_id: customerId,
    status: "pending",
    user_id: user.id,
  });

  if (!purchase) {
    return {
      error: "Could not initialize the purchase.",
      terminal: false,
    } as const;
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
      idempotencyKey: purchase.idempotency_key,
      locationId: getSquareLocationId(),
      note: `UX Hub event ticket: ${event.name}`,
      referenceId: purchase.id,
      sourceId: input.token,
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

    const reservation = await reserveEventTicketSeat(event.id, user.id, purchase.id);

    if (!reservation?.registration_id || reservation.failure_reason) {
      await cancelSquarePaymentIfPossible(payment.id);
      await updatePurchase(adminDb, purchase.id, {
        failure_reason: formatReservationFailure(reservation?.failure_reason),
        status: "canceled",
      });

      return {
        error: formatReservationFailure(reservation?.failure_reason),
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
    console.error(
      `Square event ticket payment failed for purchase ${purchase.id}:`,
      getSquareErrorDiagnostic(error)
    );

    const purchaseRecord = await fetchPurchaseById(adminDb, purchase.id);
    const paymentId = purchaseRecord?.square_payment_id ?? null;

    if (paymentId && isDefinitiveSquareFailure(error)) {
      await cancelSquarePaymentIfPossible(paymentId);
    }

    if (isDefinitiveSquareFailure(error)) {
      await releaseEventTicketSeatReservation(purchase.id).catch(() => undefined);
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
    input.idempotencyKey
  );

  if (existingAttempt) {
    return existingAttempt;
  }

  const result =
    input.kind === "membership"
      ? await createSquarePaymentForMembership(user, input)
      : await createSquarePaymentForEventTicket(user, input);

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
  rawPayload: Json = event as Json
) {
  const eventId = event.eventId;
  const eventType = event.type;
  const payment = event.data?.object?.payment;

  if (!eventId || !eventType || !payment?.id) {
    return;
  }

  const wasRecorded = await recordSquareWebhookEvent(adminDb, {
    event_id: eventId,
    event_type: eventType,
    payload: rawPayload,
  });

  if (!wasRecorded) {
    return;
  }

  let purchase = await fetchPurchaseBySquarePaymentId(adminDb, payment.id);

  // A create-payment response can be lost after Square accepts the charge but
  // before we persist its payment ID. Square echoes our purchase ID as the
  // reference ID, so a signed webhook can safely repair that ambiguous state.
  if (!purchase && payment.referenceId) {
    const candidate = await fetchPurchaseById(adminDb, payment.referenceId);
    if (matchesReferencedPurchase(payment, candidate)) {
      purchase = candidate;
    }
  }

  if (!purchase) return;

  await applyPaymentStateToPurchase(purchase.id, payment);
}
