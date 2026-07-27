"use client";

import { useEffect, useState } from "react";

import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPurchasesForUser,
  type PurchaseWithDetails,
} from "@/lib/supabase-helpers/purchases";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/date";

const supabase = createClient();

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed py-16 text-center">
        <p className="text-table">No purchases yet</p>
        <p className="text-small text-muted-foreground">
          Your memberships and event tickets will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {purchases.map((purchase) => {
        const title =
          purchase.kind === "membership"
            ? purchase.membership_types?.name || "Membership purchase"
            : purchase.events?.name || "Event ticket";
        const type =
          purchase.kind === "membership" ? "Annual membership" : "Event ticket";

        return (
          <div
            key={purchase.id}
            className="flex items-start justify-between gap-4 rounded-lg border p-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-table">{title}</p>
              <p className="text-small text-muted-foreground">{type}</p>
              <p className="text-small text-muted-foreground">
                {formatTimestamp(purchase.created_at) ?? "Unknown date"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-table">
                {formatCurrency(purchase.amount_cents, purchase.currency)}
              </p>
              <Badge variant="secondary" className="capitalize">
                {purchase.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
