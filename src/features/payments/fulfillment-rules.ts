import { SquareError } from "square";

export function splitBuyerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const givenName = parts[0] || undefined;
  const familyName = parts.slice(1).join(" ") || undefined;

  return { givenName, familyName };
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

export function getSquareErrorMessage(
  error: unknown,
  fallback = "Payment processing failed."
) {
  if (error instanceof SquareError) {
    return error.errors[0]?.detail || error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function formatReservationFailure(reason: string | null | undefined) {
  switch (reason) {
    case "APPLICATION_REQUIRED":
      return "This event uses an application flow and cannot be purchased directly.";
    case "APPLICATION_NOT_ACCEPTED":
      return "This application must be accepted before checkout can continue.";
    case "APPLICATION_NOT_ALLOWED":
      return "This event does not use applications.";
    case "INVALID_PURCHASE":
      return "This checkout attempt could not be matched to the event.";
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
