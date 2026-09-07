import { NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { processSquarePaymentEvent } from "@/features/payments/fulfillment";
import { getSquareWebhookEndpoints } from "@/lib/square/client";
import type { Json } from "@/lib/supabase/database.types";
import { parseSquarePaymentUpdatedEvent } from "@/lib/square/webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");

  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing Square signature" }, { status: 400 });
  }

  const endpoints = getSquareWebhookEndpoints(request.url);
  const verifications = await Promise.all(
    endpoints.map((endpoint) =>
      WebhooksHelper.verifySignature({
        notificationUrl: endpoint.notificationUrl,
        requestBody: rawBody,
        signatureHeader,
        signatureKey: endpoint.signatureKey,
      }).catch(() => false)
    )
  );

  if (!verifications.some(Boolean)) {
    return NextResponse.json({ error: "Invalid Square signature" }, { status: 403 });
  }

  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (
    typeof rawPayload !== "object" ||
    rawPayload === null ||
    Array.isArray(rawPayload)
  ) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const eventType = (rawPayload as Record<string, unknown>).type;

  if (eventType !== "payment.updated") {
    return NextResponse.json({ ok: true });
  }

  let event;

  try {
    event = parseSquarePaymentUpdatedEvent(rawPayload);
  } catch (error) {
    console.error("Invalid Square payment.updated payload:", error);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    await processSquarePaymentEvent(event, rawPayload as Json);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Square webhook handling failed:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
