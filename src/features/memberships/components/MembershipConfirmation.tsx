"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { useUser } from "@/lib/auth/user-context";
import { useConfirmationPolling } from "@/features/payments/use-confirmation-polling";
import { isFullyRefunded } from "@/features/payments/purchase-status";

export function MembershipConfirmation({
  purchase,
}: {
  purchase: PurchaseWithDetails;
}) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const refreshedUser = useRef(false);
  // A refund leaves the status completed (it mirrors Square's payment), so a
  // revisit after a full refund must not still read "now active".
  const refunded = purchase.status === "completed" && isFullyRefunded(purchase);
  const completed = purchase.status === "completed" && !refunded;
  const failed = purchase.status === "failed" || purchase.status === "canceled";
  const pending = !completed && !failed && !refunded;
  const refresh = useCallback(() => router.refresh(), [router]);
  const pollingCutoffReached = useConfirmationPolling(pending, refresh);

  useEffect(() => {
    if (completed && !refreshedUser.current) {
      refreshedUser.current = true;
      void refreshUser();
    }
  }, [completed, refreshUser]);

  return (
    <div className="text-center">
      <div className="max-w-lg">
        {completed ? (
          <Check className="mx-auto size-16 rounded-full bg-success-foreground/10 p-3 text-success-foreground" />
        ) : refunded ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-muted p-3 text-muted-foreground" />
        ) : failed ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-destructive/10 p-3 text-destructive" />
        ) : (
          <LoaderCircle className="mx-auto size-16 animate-spin text-primary" />
        )}
        <h1 className="mt-6 text-h1">
          {completed
            ? "Membership confirmed"
            : refunded
              ? "Payment refunded"
              : failed
              ? "Payment wasn’t completed"
              : pollingCutoffReached
                ? "Membership is still processing"
                : "Membership processing"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {completed
            ? purchase.confirmation_email_sent_at
              ? `Your ${purchase.membership_types?.name ?? "UX Hub"} membership is now active. A confirmation email has been sent to your inbox.`
              : `Your ${purchase.membership_types?.name ?? "UX Hub"} membership is now active.`
            : refunded
              ? `This ${purchase.membership_types?.name ?? "UX Hub"} membership payment was refunded in full. Check your purchases for details.`
              : failed
              ? purchase.failure_reason ?? "Your payment could not be completed."
              : pollingCutoffReached
                ? "This is taking longer than expected. You can leave this page and check your purchases later; we won’t submit another charge."
                : "We’re still confirming your payment and membership details."}
        </p>
        {/*
          A completed purchase makes /portal/membership a dead end: the plans
          route sees the new membership and renders "You're already a member".
          Those users go to the portal; a failed or pending one can still pick
          a tier.
        */}
        <Button asChild className="mt-8">
          <Link
            href={
              completed
                ? "/portal"
                : pollingCutoffReached || refunded
                  ? "/portal#settings/purchases"
                  : "/portal/membership"
            }
          >
            {completed
              ? "Go to portal"
              : pollingCutoffReached || refunded
                ? "View purchases"
                : "Back to membership"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
