import {
  serialization,
  type PaymentUpdatedEvent,
  type RefundCreatedEvent,
  type RefundUpdatedEvent,
} from "square";

export interface SquareWebhookEndpoint {
  notificationUrl: string;
  signatureKey: string;
}

interface SquareWebhookEnv {
  endpoints: string | undefined;
  fallbackUrl: string;
  notificationUrl: string | undefined;
  signatureKey: string | undefined;
}

export function parseSquarePaymentUpdatedEvent(
  payload: unknown
): PaymentUpdatedEvent {
  const result = serialization.PaymentUpdatedEvent.parse(payload, {
    unrecognizedObjectKeys: "passthrough",
  });

  if (!result.ok) {
    const details = result.errors
      .map((error) => `${error.path.join(".")}: ${error.message}`)
      .join(", ");
    throw new Error(`Invalid Square payment.updated payload: ${details}`);
  }

  const event = result.value;

  if (
    event.type !== "payment.updated" ||
    !event.eventId ||
    !event.data?.object?.payment?.id
  ) {
    throw new Error(
      "Invalid Square payment.updated payload: missing event ID or payment ID."
    );
  }

  return event;
}

export type SquareRefundEvent = RefundCreatedEvent | RefundUpdatedEvent;

const SQUARE_REFUND_EVENT_TYPES: readonly string[] = ["refund.created", "refund.updated"];

export function isSquareRefundEventType(type: unknown): boolean {
  return typeof type === "string" && SQUARE_REFUND_EVENT_TYPES.includes(type);
}

/**
 * Parses a `refund.created` or `refund.updated` delivery. Processing doesn't
 * trust the refund's status in the payload: it fetches the payment and its
 * refunds, so the payment ID is what matters here.
 */
export function parseSquareRefundEvent(payload: unknown): SquareRefundEvent {
  const type = (payload as { type?: unknown } | null)?.type;
  if (!isSquareRefundEventType(type)) {
    throw new Error("Invalid Square refund payload: not a refund event.");
  }

  const result = (
    type === "refund.created"
      ? serialization.RefundCreatedEvent
      : serialization.RefundUpdatedEvent
  ).parse(payload, { unrecognizedObjectKeys: "passthrough" });

  if (!result.ok) {
    const details = result.errors
      .map((error) => `${error.path.join(".")}: ${error.message}`)
      .join(", ");
    throw new Error(`Invalid Square ${type} payload: ${details}`);
  }

  const event = result.value;
  const refund = event.data?.object?.refund;

  if (!event.eventId || !refund?.id || !refund.paymentId) {
    throw new Error(
      `Invalid Square ${type} payload: missing event ID, refund ID or payment ID.`
    );
  }

  return event;
}

/**
 * Square signs each delivery with the subscription's own key, over that
 * subscription's registered notification URL. An app served from more than one
 * hostname therefore needs the URL and key kept together as a pair.
 *
 * `SQUARE_WEBHOOK_ENDPOINTS` carries one `<url>|<key>` pair per comma-separated
 * entry. `SQUARE_WEBHOOK_SIGNATURE_KEY` with `SQUARE_WEBHOOK_NOTIFICATION_URL`
 * still describes a single subscription, and both may be set at once.
 */
export function parseSquareWebhookEndpoints({
  endpoints,
  fallbackUrl,
  notificationUrl,
  signatureKey,
}: SquareWebhookEnv): SquareWebhookEndpoint[] {
  const parsed = (endpoints ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.lastIndexOf("|");

      if (separator === -1) {
        throw new Error(
          "SQUARE_WEBHOOK_ENDPOINTS entries must be formatted as <url>|<signature key>."
        );
      }

      return {
        notificationUrl: entry.slice(0, separator).trim(),
        signatureKey: entry.slice(separator + 1).trim(),
      };
    });

  if (signatureKey) {
    parsed.push({
      notificationUrl: notificationUrl || fallbackUrl,
      signatureKey,
    });
  }

  const complete = parsed.filter(
    (endpoint) => endpoint.notificationUrl && endpoint.signatureKey
  );

  if (complete.length === 0) {
    throw new Error(
      "Missing required environment variable: SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_ENDPOINTS"
    );
  }

  return complete;
}
