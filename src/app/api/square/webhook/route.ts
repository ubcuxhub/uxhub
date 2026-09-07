import { NextResponse } from "next/server";
import { WebhooksHelper, type PaymentUpdatedEvent } from "square";
import { processSquarePaymentEvent } from "@/features/payments/fulfillment";
import { getSquareWebhookEndpoints } from "@/lib/square/client";

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
