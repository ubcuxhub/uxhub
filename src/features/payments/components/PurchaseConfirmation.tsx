"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { useConfirmationPolling } from "@/features/payments/use-confirmation-polling";
import { isFullyRefunded } from "@/features/payments/purchase-status";

/**
 * Where a purchase stands on its confirmation page. `stalled` is a pending
 * one that polling has given up on.
 */
export type ConfirmationState = "completed" | "refunded" | "failed" | "pending" | "stalled";

/** What the page says, and where its one button goes, in a given state. */
export interface ConfirmationCopy {
  title: string;
  body: string;
  action: { href: string; label: string };
}

/** The failure copy every purchase kind shares. */
export function failureBody(purchase: PurchaseWithDetails) {
  return purchase.failure_reason ?? "Your payment could not be completed.";
}

/** The stalled copy every purchase kind shares. */
export const STALLED_BODY =
  "This is taking longer than expected. You can leave this page and check your purchases later; we won’t submit another charge.";

/**
 * The confirmation page for a ticket or membership purchase: a status icon,
 * a headline, a line of copy and one button. It refreshes the route while the
 * payment is pending (`useConfirmationPolling`) and calls `onCompleted` once
 * when the purchase reads as completed.
 */
export function PurchaseConfirmation({
  purchase,
  copy,
  onCompleted,
}: {
  purchase: PurchaseWithDetails;
  copy: (state: ConfirmationState) => ConfirmationCopy;
  onCompleted?: () => void;
}) {
  const router = useRouter();
  // A refund leaves the status completed (it mirrors Square's payment), so a
  // revisit after a full refund must not still read as confirmed.
  const refunded = purchase.status === "completed" && isFullyRefunded(purchase);
  const completed = purchase.status === "completed" && !refunded;
  const failed = purchase.status === "failed" || purchase.status === "canceled";
  const pending = !completed && !failed && !refunded;
  const refresh = useCallback(() => router.refresh(), [router]);
  const pollingCutoffReached = useConfirmationPolling(pending, refresh);

  const reportedCompletion = useRef(false);
  useEffect(() => {
    if (completed && onCompleted && !reportedCompletion.current) {
      reportedCompletion.current = true;
      onCompleted();
    }
  }, [completed, onCompleted]);

  const state: ConfirmationState = completed
    ? "completed"
    : refunded
      ? "refunded"
      : failed
        ? "failed"
        : pollingCutoffReached
          ? "stalled"
          : "pending";
  const { title, body, action } = copy(state);

  return (
    <div className="text-center">
      <div className="max-w-lg">
        {state === "completed" ? (
          <Check className="mx-auto size-16 rounded-full bg-success-foreground/10 p-3 text-success-foreground" />
        ) : state === "refunded" ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-muted p-3 text-muted-foreground" />
        ) : state === "failed" ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-destructive/10 p-3 text-destructive" />
        ) : (
          <Spinner className="mx-auto size-16 text-primary" />
        )}
        <h1 className="mt-6 text-h1">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Button asChild className="mt-8">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </div>
    </div>
  );
}
