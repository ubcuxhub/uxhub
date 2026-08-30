"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";

export function EventConfirmation({
  purchase,
  slug,
}: {
  purchase: PurchaseWithDetails;
  slug: string;
}) {
  const router = useRouter();
  const completed = purchase.status === "completed";
  const failed = purchase.status === "failed" || purchase.status === "canceled";
  const pending = !completed && !failed;
  const eventName = purchase.events?.name ?? "the event";
  const eventHref = `/portal/events/${purchase.events?.slug ?? slug}`;

  useEffect(() => {
    if (!pending) return;

    const refreshInterval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(refreshInterval);
  }, [pending, router]);

  return (
    <div className="text-center">
      <div className="max-w-lg">
        {completed ? (
          <Check className="mx-auto size-16 rounded-full bg-success/10 p-3 text-success" />
        ) : failed ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-destructive/10 p-3 text-destructive" />
        ) : (
          <LoaderCircle className="mx-auto size-16 animate-spin text-primary" />
        )}
        <h1 className="mt-6 text-h1">
          {completed
            ? "Payment successful"
            : failed
              ? "Payment wasn’t completed"
              : "Payment processing"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {completed
            ? purchase.confirmation_email_sent_at
              ? `You’re registered for ${eventName}. A confirmation email has been sent to your inbox.`
              : `You’re registered for ${eventName}.`
            : failed
              ? purchase.failure_reason ?? "Your payment could not be completed."
              : "We’re still confirming your payment and event registration."}
        </p>
        <Button asChild className="mt-8">
          <Link href={eventHref}>Back to event</Link>
        </Button>
      </div>
    </div>
  );
}
