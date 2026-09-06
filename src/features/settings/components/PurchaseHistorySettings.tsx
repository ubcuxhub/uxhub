"use client";

import { useEffect, useState } from "react";

import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPurchasesForUser,
  type PurchaseWithDetails,
} from "@/lib/supabase-helpers/purchases";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/date";
import { cn } from "@/lib/utils";

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

export function PurchaseHistorySettings() {
  const { user } = useUser();
  const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchPurchasesForUser(supabase, user.id)
      .then(setPurchases)
      .catch((e) => console.error("Error loading purchases:", e))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PurchaseListSkeleton />;
  if (purchases.length === 0) return <EmptyPurchases />;

  return (
    <div className="flex flex-col">
      {purchases.map((purchase) => (
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
            "text-small capitalize",
            PROBLEM_STATUSES.has(purchase.status)
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {purchase.status}
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

function PurchaseListSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
        >
          <div className="w-full max-w-56 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="w-20 space-y-2">
            <Skeleton className="ml-auto h-4 w-12" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
