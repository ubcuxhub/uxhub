"use client";

import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import {
  PurchaseConfirmation,
  STALLED_BODY,
  failureBody,
  type ConfirmationCopy,
  type ConfirmationState,
} from "@/features/payments/components/PurchaseConfirmation";

export function EventConfirmation({
  purchase,
  slug,
}: {
  purchase: PurchaseWithDetails;
  slug: string;
}) {
  const free = purchase.amount_cents === 0;
  const eventName = purchase.events?.name ?? "the event";
  const backToEvent = { href: `/portal/events/${purchase.events?.slug ?? slug}`, label: "Back to event" };

  // A full refund takes the ticket back, so a revisit must not read "registered".
  const copy = (state: ConfirmationState): ConfirmationCopy => {
    switch (state) {
      case "completed":
        return {
          title: free ? "Registration confirmed" : "Payment successful",
          body: purchase.confirmation_email_sent_at
            ? `You’re registered for ${eventName}. A confirmation email has been sent to your inbox.`
            : `You’re registered for ${eventName}.`,
          action: backToEvent,
        };
      case "refunded":
        return {
          title: "Payment refunded",
          body: `Your payment for ${eventName} was refunded in full.`,
          action: backToEvent,
        };
      case "failed":
        return { title: "Payment wasn’t completed", body: failureBody(purchase), action: backToEvent };
      case "stalled":
        return {
          title: "Payment is still processing",
          body: STALLED_BODY,
          action: { href: "/portal#settings/purchases", label: "View purchases" },
        };
      case "pending":
        return {
          title: "Payment processing",
          body: "We’re still confirming your payment and event registration.",
          action: backToEvent,
        };
    }
  };

  return <PurchaseConfirmation purchase={purchase} copy={copy} />;
}
