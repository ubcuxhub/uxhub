"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { useUser } from "@/context/UserContext";

export function MembershipConfirmation({
  purchase,
}: {
  purchase: PurchaseWithDetails;
}) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const refreshedUser = useRef(false);
  const completed = purchase.status === "completed";
  const failed = purchase.status === "failed" || purchase.status === "canceled";
  const pending = !completed && !failed;

  useEffect(() => {
    if (completed && !refreshedUser.current) {
      refreshedUser.current = true;
      void refreshUser();
    }
  }, [completed, refreshUser]);

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
            ? "Membership confirmed"
            : failed
              ? "Payment wasn’t completed"
              : "Membership processing"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {completed
            ? purchase.confirmation_email_sent_at
              ? `Your ${purchase.membership_types?.name ?? "UX Hub"} membership is now active. A confirmation email has been sent to your inbox.`
              : `Your ${purchase.membership_types?.name ?? "UX Hub"} membership is now active.`
            : failed
              ? purchase.failure_reason ?? "Your payment could not be completed."
              : "We’re still confirming your payment and membership details."}
        </p>
        <Button asChild className="mt-8">
          <Link href="/portal/membership">Back to membership</Link>
        </Button>
      </div>
    </div>
  );
}
