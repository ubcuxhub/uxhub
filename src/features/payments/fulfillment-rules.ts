import { SquareError } from "square";

interface ReferencedSquarePayment {
  amountMoney?: {
    amount?: bigint | null;
    currency?: string | null;
  };
  id?: string;
  referenceId?: string;
}

interface ReferencedPurchase {
  amount_cents: number;
  currency: string;
  id: string;
  square_payment_id: string | null;
}

export function matchesReferencedPurchase(
  payment: ReferencedSquarePayment,
  purchase: ReferencedPurchase | null,
) {
  return Boolean(
    purchase &&
      payment.id &&
      payment.referenceId === purchase.id &&
      payment.amountMoney?.amount !== undefined &&
      String(payment.amountMoney.amount) === String(purchase.amount_cents) &&
      payment.amountMoney.currency === purchase.currency &&
      (!purchase.square_payment_id ||
        purchase.square_payment_id === payment.id),
  );
}

export function normalizeSquareStatus(status: string | undefined) {
  switch (status) {
    case "APPROVED":
      return "authorized" as const;
    case "COMPLETED":
      return "completed" as const;
    case "CANCELED":
      return "canceled" as const;
    case "FAILED":
      return "failed" as const;
    default:
      return "pending" as const;
  }
}

function formatSquareErrorCode(code: string | undefined) {
  switch (code) {
    case "CVV_FAILURE":
      return "The security code (CVC) on your card was rejected. Check the code and try again, or use a different card.";
    case "ADDRESS_VERIFICATION_FAILURE":
      return "The postal code did not match the one on file for your card. Check it and try again.";
    case "INVALID_EXPIRATION":
    case "BAD_EXPIRATION":
    case "EXPIRATION_FAILURE":
      return "The expiry date on your card is invalid. Check it and try again.";
    case "CARD_EXPIRED":
      return "This card has expired. Please use a different card.";
    case "INSUFFICIENT_FUNDS":
      return "Your card was declined for insufficient funds. Please use a different card.";
    case "CARD_NOT_SUPPORTED":
      return "This card is not supported for online payments. Please use a different card.";
    case "INVALID_CARD":
    case "INVALID_CARD_DATA":
    case "PAN_FAILURE":
      return "The card details you entered are not valid. Check the card number and try again.";
    case "CARD_DECLINED_CALL_ISSUER":
      return "Your bank declined the payment and asked you to contact them. Call the number on the back of your card, or use a different card.";
    case "CARD_DECLINED_VERIFICATION_REQUIRED":
      return "Your bank needs to verify this payment. Complete the verification prompt and try again, or use a different card.";
    case "ALLOWABLE_PIN_TRIES_EXCEEDED":
      return "This card is temporarily locked after too many failed attempts. Please use a different card.";
    case "TRANSACTION_LIMIT":
    case "PAYMENT_LIMIT_EXCEEDED":
    case "AMOUNT_TOO_HIGH":
      return "This payment is over a limit set on your card. Please use a different card.";
    case "CARD_TOKEN_EXPIRED":
    case "CARD_TOKEN_USED":
      return "This checkout session expired before the payment finished. Refresh the page and try again.";
    case "IDEMPOTENCY_KEY_REUSED":
      return "This payment was already submitted. Refresh the page to check whether it went through.";
    case "TEMPORARY_ERROR":
    case "RATE_LIMITED":
    case "SERVICE_UNAVAILABLE":
    case "GATEWAY_TIMEOUT":
      return "Payments are temporarily unavailable. Wait a moment and try again.";
    case "CARD_PROCESSING_NOT_ENABLED":
      return "Online payments are not enabled right now. Please contact UX Hub for help.";
    case "GENERIC_DECLINE":
    case "CARD_DECLINED":
      return "Your bank declined this payment. Check your card details and try again, or use a different card.";
    default:
      return null;
  }
}

function readCardDetail(body: unknown, key: "avs_status" | "cvv_status") {
  if (typeof body !== "object" || body === null) return null;

  const payment = (body as { payment?: unknown }).payment;
  if (typeof payment !== "object" || payment === null) return null;

  const cardDetails = (payment as { card_details?: unknown }).card_details;
  if (typeof cardDetails !== "object" || cardDetails === null) return null;

  const value = (cardDetails as Record<string, unknown>)[key];

  return typeof value === "string" ? value : null;
}

/**
 * A declined card often reports the useful reason on the payment rather than in
 * the error code: Square returns a bare GENERIC_DECLINE while `card_details`
 * records the rejected security code or postal code.
 *
 * A rejected status is only evidence about that field when the other field
 * passed. `CVV_REJECTED` means the issuer returned no positive CVV match on the
 * authorization, which is also what a decline for an unrelated reason — a wrong
 * expiry, say — looks like. So name a field only when the other one is accepted,
 * and otherwise let the caller fall back to the generic decline wording.
 */
function formatDeclineDetail(body: unknown) {
  const cvv = readCardDetail(body, "cvv_status");
  const avs = readCardDetail(body, "avs_status");

  if (cvv === "CVV_REJECTED" && avs === "AVS_ACCEPTED") {
    return formatSquareErrorCode("CVV_FAILURE");
  }

  if (avs === "AVS_REJECTED" && cvv === "CVV_ACCEPTED") {
    return formatSquareErrorCode("ADDRESS_VERIFICATION_FAILURE");
  }

  return null;
}

export function getSquareErrorMessage(
  error: unknown,
  fallback = "Payment processing failed."
) {
  if (error instanceof SquareError) {
    return (
      formatDeclineDetail(error.body) ||
      formatSquareErrorCode(error.errors[0]?.code) ||
      error.errors[0]?.detail ||
      error.message ||
      fallback
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

const AMBIGUOUS_SQUARE_CODES = new Set([
  "CARD_TOKEN_USED",
  "GATEWAY_TIMEOUT",
  "IDEMPOTENCY_KEY_REUSED",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "TEMPORARY_ERROR",
]);

/**
 * Only a definite payment-method rejection permits a fresh checkout attempt.
 * Transport and service errors can arrive after Square accepted a charge, so
 * those attempts stay pending and retain their idempotency key.
 */
export function isDefinitiveSquareFailure(error: unknown) {
  if (!(error instanceof SquareError) || error.errors.length === 0) {
    return false;
  }

  return error.errors.every(
    (entry) =>
      entry.category === "PAYMENT_METHOD_ERROR" &&
      Boolean(entry.code) &&
      !AMBIGUOUS_SQUARE_CODES.has(entry.code),
  );
}

/**
 * The buyer-facing message is stored on the purchase, so keep the raw Square
 * codes for the server log.
 */
export function getSquareErrorDiagnostic(error: unknown) {
  if (error instanceof SquareError) {
    const codes = error.errors
      .map((entry) => `${entry.code} (${entry.category}): ${entry.detail ?? ""}`)
      .join("; ");
    const cvv = readCardDetail(error.body, "cvv_status");
    const avs = readCardDetail(error.body, "avs_status");
    const verification = [
      cvv ? `cvv=${cvv}` : null,
      avs ? `avs=${avs}` : null,
    ].filter(Boolean);

    return [codes || error.message, verification.join(" ")]
      .filter(Boolean)
      .join(" | ");
  }

  return error instanceof Error ? error.message : String(error);
}

export function formatReservationFailure(reason: string | null | undefined) {
  switch (reason) {
    case "APPLICATION_REQUIRED":
      return "This event uses an application flow and cannot be purchased directly.";
    case "REGISTRATION_NOT_OPEN":
      return "Registration for this event is not open yet.";
    case "REGISTRATION_CLOSED":
      return "Registration for this event has closed.";
    case "ALREADY_REGISTERED":
      return "You already have a registration for this event.";
    case "SOLD_OUT":
      return "This event is sold out.";
    case "EVENT_NOT_FOUND":
      return "This event could not be found.";
    case "EVENT_NOT_ACTIVE":
      return "This event is no longer open for registration.";
    default:
      return "We could not reserve a ticket for this event.";
  }
}

export function getPurchaseRedirectPath() {
  return "/portal#settings/purchases";
}
