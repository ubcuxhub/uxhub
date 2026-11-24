"use client";

import { useEffect, useState } from "react";

import { useUser } from "@/lib/auth/user-context";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPurchasesForUser,
  type PurchaseWithDetails,
} from "@/lib/supabase-helpers/purchases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatTimestamp } from "@/lib/date";
import { cn } from "@/lib/utils";
import { purchaseStatusLabel } from "@/features/payments/purchase-status";

const supabase = createClient();

/** Statuses that deserve to read as a problem rather than as a footnote. */
const PROBLEM_STATUSES = new Set(["failed", "canceled", "cancelled"]);

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

/** What a purchase was for: its name, and the kind of thing it bought. */
function describePurchase(purchase: PurchaseWithDetails) {
  return purchase.kind === "membership"
    ? {
        title: purchase.membership_types?.name || "Membership purchase",
        kind: "Annual membership",
      }
    : {
        title: purchase.events?.name || "Event ticket",
        kind: "Event ticket",
      };
}

type PurchasesResult =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; purchases: PurchaseWithDetails[] };

export function PurchaseHistorySettings() {
  const { user, loading: userLoading } = useUser();
  const [result, setResult] = useState<PurchasesResult>({ status: "loading" });
  // Bumped by Try again, to read the purchases afresh.
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchPurchasesForUser(supabase, userId).then(
      (purchases) => {
        if (active) setResult({ status: "loaded", purchases });
      },
      (error) => {
        console.error("Error loading purchases:", error);
        if (active) setResult({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const retry = () => {
    setResult({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  // Signed out (the dialog lives behind sign-in, so only briefly): nothing to list.
  if (!user && !userLoading) return null;
  if (!user || result.status === "loading") {
    return (
      <div className="flex justify-center py-8">
        <Spinner label="Loading purchases" />
      </div>
    );
  }
  if (result.status === "error") return <PurchasesError onRetry={retry} />;
  if (result.purchases.length === 0) return <EmptyPurchases />;

  return (
    <div className="flex flex-col">
      {result.purchases.map((purchase) => (
        <PurchaseRow key={purchase.id} purchase={purchase} />
      ))}
    </div>
  );
}

/**
 * One purchase, laid out like a settings row: what it was on the left, what it
 * cost on the right. No card and no rule — spacing alone separates entries.
 */
function PurchaseRow({ purchase }: { purchase: PurchaseWithDetails }) {
  const { title, kind } = describePurchase(purchase);
  const date = formatTimestamp(purchase.created_at) ?? "Unknown date";

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-button">{title}</p>
        <p className="text-small text-muted-foreground">
          {kind} · {date}
        </p>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:block sm:space-y-0.5 sm:text-right">
        <p className="text-button">
          {formatCurrency(purchase.amount_cents, purchase.currency)}
        </p>
        <p
          className={cn(
            "text-small",
            PROBLEM_STATUSES.has(purchase.status)
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {purchaseStatusLabel(purchase)}
        </p>
      </div>
    </div>
  );
}

function EmptyPurchases() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-button">No purchases yet</p>
      <p className="text-small text-muted-foreground">
        Your memberships and event tickets will appear here.
      </p>
    </div>
  );
}

/** A failed read, which must not pass for an empty history. */
function PurchasesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="destructive">
        <AlertTitle>Your purchases couldn’t be loaded</AlertTitle>
        <AlertDescription>Check your connection and try again.</AlertDescription>
      </Alert>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
