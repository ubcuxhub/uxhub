import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

// route.ts imports the Square client, which reads its token at module load.
vi.hoisted(() => {
  process.env.SQUARE_ACCESS_TOKEN ??= "test-token";
});

const processMocks = vi.hoisted(() => ({
  processSquarePaymentEvent: vi.fn(),
  getSquareWebhookEndpoints: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/payments/fulfillment", () => ({
  processSquarePaymentEvent: processMocks.processSquarePaymentEvent,
}));

vi.mock("@/lib/square/client", () => ({
  getSquareWebhookEndpoints: processMocks.getSquareWebhookEndpoints,
}));

const url = "https://request.example/api/square/webhook";
const signatureKey = "test-signature-key";

function sign(notificationUrl: string, body: string, key: string) {
  return createHmac("sha256", key)
    .update(notificationUrl + body)
    .digest("base64");
}

function post(body: string, signatureHeader?: string) {
  const headers = new Headers();
  if (signatureHeader !== undefined) {
    headers.set("x-square-hmacsha256-signature", signatureHeader);
  }

  return POST(new Request(url, { method: "POST", body, headers }));
}

const paymentUpdatedPayload = {
  merchant_id: "merchant-1",
  type: "payment.updated",
  event_id: "event-1",
  created_at: "2026-09-07T20:43:07Z",
  data: {
    type: "payment",
    id: "payment-1",
    object: {
      payment: {
        id: "payment-1",
        status: "COMPLETED",
      },
    },
  },
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  processMocks.getSquareWebhookEndpoints.mockReturnValue([
    { notificationUrl: url, signatureKey },
  ]);
  processMocks.processSquarePaymentEvent.mockResolvedValue(undefined);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("POST /api/square/webhook", () => {
  it("rejects a request with no signature header", async () => {
    const response = await post(JSON.stringify(paymentUpdatedPayload));

    expect(response.status).toBe(400);
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("rejects a request with a signature that doesn't match", async () => {
    const response = await post(
      JSON.stringify(paymentUpdatedPayload),
      "not-the-right-signature"
    );

    expect(response.status).toBe(403);
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("accepts a signature matching any one of several configured endpoints", async () => {
    processMocks.getSquareWebhookEndpoints.mockReturnValue([
      { notificationUrl: "https://a.example/webhook", signatureKey: "key-a" },
      { notificationUrl: url, signatureKey },
    ]);

    const body = JSON.stringify(paymentUpdatedPayload);
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(200);
    expect(processMocks.processSquarePaymentEvent).toHaveBeenCalledOnce();
  });

  it("rejects a body that isn't JSON", async () => {
    const body = "not json";
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(400);
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("rejects a JSON body that isn't an object", async () => {
    const body = JSON.stringify(["payment.updated"]);
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(400);
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("acknowledges but skips event types other than payment.updated", async () => {
    const body = JSON.stringify({ type: "refund.updated" });
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("rejects a payment.updated payload missing required fields", async () => {
    const body = JSON.stringify({ type: "payment.updated", data: {} });
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(400);
    expect(processMocks.processSquarePaymentEvent).not.toHaveBeenCalled();
  });

  it("processes a valid, correctly signed payment.updated event", async () => {
    const body = JSON.stringify(paymentUpdatedPayload);
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(processMocks.processSquarePaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        type: "payment.updated",
      }),
      expect.objectContaining({ event_id: "event-1" })
    );
  });

  // Square retries a webhook delivery on a 5xx response, so a processing
  // failure must surface as 500 rather than an acknowledged 200/400.
  it("returns 500 so Square retries when processing throws", async () => {
    processMocks.processSquarePaymentEvent.mockRejectedValue(
      new Error("database unavailable")
    );

    const body = JSON.stringify(paymentUpdatedPayload);
    const response = await post(body, sign(url, body, signatureKey));

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
  });
});
