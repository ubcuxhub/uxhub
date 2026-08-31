import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment, PaymentUpdatedEvent } from "square";
import type { UserInfoRow } from "@/types/models";
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
  getSquareErrorMessage,
  getPurchaseRedirectPath,
  normalizeSquareStatus,
} from "./fulfillment-rules";
import { isEligibleForMembership } from "@/features/memberships/lib/policy";
import { ensureSquareCustomerId } from "./customer";
import { sendPurchaseConfirmationEmail } from "./confirmation-email";
import { revalidatePurchasePaths } from "./revalidation";

const adminDb = supabaseAdmin as unknown as SupabaseClient<Database>;

function getMembershipExpiryIsoString() {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry.toISOString();
}
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

  await updateUserInfoById(adminDb, purchase.user_id, {
    membership_expires_at: getMembershipExpiryIsoString(),
    membership_pre_ordered_type_id: null,
    membership_type_id: purchase.membership_type_id,
    square_customer_id: purchase.square_customer_id,
  });

  await revalidatePurchasePaths(adminDb, purchase.id);
  after(() => sendPurchaseConfirmationEmail(adminDb, purchase.id));
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
  after(() => sendPurchaseConfirmationEmail(adminDb, purchase.id));
  return updatedPurchase;
}

async function fulfillCompletedPurchase(purchaseId: string) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);

  if (!purchase || purchase.fulfilled_at) {
    return purchase;
  }

  if (purchase.kind === "membership") {
    return fulfillMembershipPurchase(purchase.id);
  }

  return fulfillEventTicketPurchase(purchase.id);
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
    return {
      ok: false,
      error: "This checkout attempt belongs to a different account.",
    };
  }

  if (existingPurchase.status === "completed") {
    await fulfillCompletedPurchase(existingPurchase.id);

    return {
      ok: true,
      purchaseId: existingPurchase.id,
      redirectTo: getPurchaseRedirectPath(),
    };
  }

  if (
    existingPurchase.status === "failed" ||
    existingPurchase.status === "canceled"
  ) {
    return {
      ok: false,
      error:
        existingPurchase.failure_reason ||
        "Your previous checkout attempt did not complete. Please try again.",
    };
  }

  return {
    ok: false,
    error:
      "This checkout attempt is already being processed. Please check your purchases page in a moment.",
  };
}

async function createSquarePaymentForMembership(
  user: UserInfoRow,
  input: CheckoutRequestInput
) {
  const membershipType = await fetchMembershipTypeBySlug(adminDb, input.slug);

  if (!membershipType) {
    return { error: "Membership plan not found." } as const;
  }

  if (!isEligibleForMembership(user, membershipType)) {
    return {
      error: "This membership tier is not available for your account.",
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
    });

    const payment = paymentResponse.payment;

    if (!payment?.id) {
      throw new Error("Square did not return a payment ID.");
    }

    await applyPaymentStateToPurchase(purchase.id, payment);

    return {
      purchaseId: purchase.id,
    } as const;
  } catch (error) {
    await updatePurchase(adminDb, purchase.id, {
      failure_reason: getSquareErrorMessage(error),
      status: "failed",
    });

    return {
      error: getSquareErrorMessage(error),
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
    return { error: "Event not found." } as const;
  }

  const applicationQuestions = event.applications_enabled
    ? await fetchApplicationQuestions(adminDb, event.id)
    : [];

  if (applicationQuestions.length > 0) {
    return {
      error:
        "This event uses an application flow and cannot be purchased directly.",
    } as const;
  }

  const existingRegistration = await fetchUserRegistration(adminDb, event.id, user.id);

  if (existingRegistration) {
    return {
      error: "You already have a registration for this event.",
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
    return { error: "Could not initialize the purchase." } as const;
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
      } as const;
    }

    const captureResponse = await squareClient.payments.complete({
      paymentId: payment.id,
    });
    const capturedPayment = captureResponse.payment;

    if (!capturedPayment?.id) {
      throw new Error("Square did not return the completed payment.");
    }

    await applyPaymentStateToPurchase(purchase.id, capturedPayment);

    return {
      purchaseId: purchase.id,
    } as const;
  } catch (error) {
    const purchaseRecord = await fetchPurchaseById(adminDb, purchase.id);
    const paymentId = purchaseRecord?.square_payment_id ?? null;

    if (paymentId) {
      await cancelSquarePaymentIfPossible(paymentId);
    }

    await releaseEventTicketSeatReservation(purchase.id).catch(() => undefined);
    await updatePurchase(adminDb, purchase.id, {
      failure_reason: getSquareErrorMessage(error),
      status: "failed",
    });

    return {
      error: getSquareErrorMessage(error),
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
    };
  }

  if (!("purchaseId" in result) || !result.purchaseId) {
    return {
      ok: false,
      error: "Checkout finished without a purchase record.",
    };
  }

  return {
    ok: true,
    purchaseId: result.purchaseId,
    redirectTo: getPurchaseRedirectPath(),
  };
}

export async function processSquarePaymentEvent(
  event: PaymentUpdatedEvent
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
    payload: event as Json,
  });

  if (!wasRecorded) {
    return;
  }

  const purchase = await fetchPurchaseBySquarePaymentId(adminDb, payment.id);

  if (!purchase) {
    return;
  }

  await applyPaymentStateToPurchase(purchase.id, payment);
}
