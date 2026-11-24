import type { CheckoutRequestInput, PurchaseKind } from "./types";

/** A checkout request the server can't act on, with a message for the buyer. */
export class CheckoutRequestError extends Error {
  override name = "CheckoutRequestError";
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CheckoutRequestError(`${fieldName} is required.`);
  }

  return value.trim();
}

function asPurchaseKind(value: unknown): PurchaseKind {
  if (value === "event_ticket" || value === "membership") {
    return value;
  }

  throw new CheckoutRequestError("Invalid purchase kind.");
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates what the checkout form sent. Throws `CheckoutRequestError` for a
 * malformed request. Fields the server doesn't use (the buyer's name, email,
 * phone and postal code, which older clients still send) are ignored: the
 * buyer's details come from their profile.
 */
export function parseCheckoutRequest(
  input: unknown
): CheckoutRequestInput {
  if (typeof input !== "object" || input === null) {
    throw new CheckoutRequestError("Invalid checkout payload.");
  }

  const payload = input as Record<string, unknown>;
  const kind = asPurchaseKind(payload.kind);
  const expectedAmountCents = payload.expectedAmountCents;
  if (expectedAmountCents !== undefined &&
      (typeof expectedAmountCents !== "number" || !Number.isSafeInteger(expectedAmountCents) || expectedAmountCents < 0)) {
    throw new CheckoutRequestError("Invalid expected amount.");
  }
  return {
    kind,
    slug: asNonEmptyString(payload.slug, "Product slug"),
    // Required for a paid purchase, which checkout decides from the price.
    token: asOptionalString(payload.token),
    ...(expectedAmountCents !== undefined ? { expectedAmountCents: expectedAmountCents as number } : {}),
    idempotencyKey: asNonEmptyString(
      payload.idempotencyKey,
      "Checkout idempotency key"
    ),
    verificationToken: asOptionalString(payload.verificationToken),
  };
}
