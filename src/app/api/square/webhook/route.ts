import { NextResponse } from "next/server";
import { WebhooksHelper, type PaymentUpdatedEvent } from "square";
import { processSquarePaymentEvent } from "@/features/payments/fulfillment";
import {
  getSquareWebhookNotificationUrl,
  getSquareWebhookSignatureKey,
} from "@/lib/square/client";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");

  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing Square signature" }, { status: 400 });
  }

  const isValid = await WebhooksHelper.verifySignature({
    notificationUrl: getSquareWebhookNotificationUrl(request.url),
    requestBody: rawBody,
    signatureHeader,
    signatureKey: getSquareWebhookSignatureKey(),
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid Square signature" }, { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as PaymentUpdatedEvent;

    if (payload.type === "payment.updated") {
      await processSquarePaymentEvent(payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Square webhook handling failed:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
