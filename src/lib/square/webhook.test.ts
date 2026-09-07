import { describe, expect, it } from "vitest";
import { parseSquareWebhookEndpoints } from "./webhook";

const fallbackUrl = "https://request.example/api/square/webhook";

describe("parseSquareWebhookEndpoints", () => {
  it("pairs each configured subscription with its own key", () => {
    expect(
      parseSquareWebhookEndpoints({
        endpoints:
          "https://www.ubcuxhub.ca/api/square/webhook|key-one, https://uxhub-portal.vercel.app/api/square/webhook|key-two",
        fallbackUrl,
        notificationUrl: undefined,
        signatureKey: undefined,
      })
    ).toEqual([
      {
        notificationUrl: "https://www.ubcuxhub.ca/api/square/webhook",
        signatureKey: "key-one",
      },
      {
        notificationUrl: "https://uxhub-portal.vercel.app/api/square/webhook",
        signatureKey: "key-two",
      },
    ]);
  });

  it("keeps the single-subscription variables working", () => {
    expect(
      parseSquareWebhookEndpoints({
        endpoints: undefined,
        fallbackUrl,
        notificationUrl: "https://www.ubcuxhub.ca/api/square/webhook",
        signatureKey: "key-one",
      })
    ).toEqual([
      {
        notificationUrl: "https://www.ubcuxhub.ca/api/square/webhook",
        signatureKey: "key-one",
      },
    ]);
  });

  it("falls back to the request URL when no notification URL is configured", () => {
    expect(
      parseSquareWebhookEndpoints({
        endpoints: undefined,
        fallbackUrl,
        notificationUrl: undefined,
        signatureKey: "key-one",
      })
    ).toEqual([{ notificationUrl: fallbackUrl, signatureKey: "key-one" }]);
  });

  it("combines both forms of configuration", () => {
    const endpoints = parseSquareWebhookEndpoints({
      endpoints: "https://www.ubcuxhub.ca/api/square/webhook|key-one",
      fallbackUrl,
      notificationUrl: "https://uxhub-portal.vercel.app/api/square/webhook",
      signatureKey: "key-two",
    });

    expect(endpoints).toHaveLength(2);
    expect(endpoints.map((endpoint) => endpoint.signatureKey)).toEqual([
      "key-one",
      "key-two",
    ]);
  });

  it("rejects an entry that is missing its separator", () => {
    expect(() =>
      parseSquareWebhookEndpoints({
        endpoints: "https://www.ubcuxhub.ca/api/square/webhook",
        fallbackUrl,
        notificationUrl: undefined,
        signatureKey: undefined,
      })
    ).toThrow(/<url>\|<signature key>/);
  });

  it("rejects a configuration with no signature key at all", () => {
    expect(() =>
      parseSquareWebhookEndpoints({
        endpoints: undefined,
        fallbackUrl,
        notificationUrl: "https://www.ubcuxhub.ca/api/square/webhook",
        signatureKey: undefined,
      })
    ).toThrow(/SQUARE_WEBHOOK_SIGNATURE_KEY/);
  });
});
