import "server-only";

import { SquareClient, SquareEnvironment } from "square";

export const SQUARE_API_VERSION = "2025-10-16" as const;
export const SQUARE_CURRENCY = "CAD" as const;

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSquareLocationId() {
  return requiredEnv("NEXT_PUBLIC_SQUARE_LOCATION_ID");
}

export function getSquareWebhookSignatureKey() {
  return requiredEnv("SQUARE_WEBHOOK_SIGNATURE_KEY");
}

export function getSquareWebhookNotificationUrl(fallbackUrl: string) {
  return process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || fallbackUrl;
}

function getSquareEnvironment() {
  return process.env.SQUARE_ENV === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
}

export const squareClient = new SquareClient({
  token: requiredEnv("SQUARE_ACCESS_TOKEN"),
  environment: getSquareEnvironment(),
  version: SQUARE_API_VERSION,
});
