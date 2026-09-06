import type { CheckoutRequestInput, PurchaseKind } from "./types";

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function asPurchaseKind(value: unknown): PurchaseKind {
  if (value === "event_ticket" || value === "membership") {
    return value;
  }

  throw new Error("Invalid purchase kind.");
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseCheckoutRequest(
  input: unknown
): CheckoutRequestInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid checkout payload.");
  }

  const payload = input as Record<string, unknown>;
  const buyerEmail = asNonEmptyString(payload.buyerEmail, "Email");

  if (!isValidEmail(buyerEmail)) {
    throw new Error("Enter a valid email address.");
  }

  return {
    kind: asPurchaseKind(payload.kind),
    slug: asNonEmptyString(payload.slug, "Product slug"),
    token: asNonEmptyString(payload.token, "Payment token"),
    idempotencyKey: asNonEmptyString(
      payload.idempotencyKey,
      "Checkout idempotency key"
    ),
    buyerFirstName: asNonEmptyString(payload.buyerFirstName, "First name"),
    buyerLastName: asNonEmptyString(payload.buyerLastName, "Last name"),
    buyerEmail,
    buyerPhone: asOptionalString(payload.buyerPhone),
    billingPostalCode: asOptionalString(payload.billingPostalCode),
  };
}
