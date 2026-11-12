import "server-only";

import { SquareClient, SquareEnvironment } from "square";

import { parseSquareWebhookEndpoints } from "./webhook";

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

export function getSquareWebhookEndpoints(fallbackUrl: string) {
  return parseSquareWebhookEndpoints({
    endpoints: process.env.SQUARE_WEBHOOK_ENDPOINTS,
    fallbackUrl,
    notificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
  });
}

function getSquareEnvironment() {
  return process.env.SQUARE_ENV === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
}

let client: SquareClient | undefined;

function getClient() {
  client ??= new SquareClient({
    token: requiredEnv("SQUARE_ACCESS_TOKEN"),
    environment: getSquareEnvironment(),
    version: "2026-09-16",
  });
  return client;
}

// Importing checkout must not require payment credentials for free events.
// Paid operations still validate configuration before contacting Square.
export const squareClient = {
  get payments() { return getClient().payments; },
  get customers() { return getClient().customers; },
};
