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
