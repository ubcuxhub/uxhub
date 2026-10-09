"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/date";
import { fetchAdminUserPurchasesAction } from "../user-purchases-action";
import type { UserPurchaseSummary } from "../types";

type PurchaseState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; purchases: UserPurchaseSummary[] };

// Mounted only while the user modal is open; keyed by user id by its parent.
export function UserRecentTransactions({ userId }: { userId: string }) {
  const [state, setState] = useState<PurchaseState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchAdminUserPurchasesAction(userId)
      .then((purchases) => {
        if (active) setState({ status: "ready", purchases });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => { active = false; };
  }, [userId, attempt]);

  return (
    <section className="space-y-3" aria-label="Recent Transactions">
      <h3 className="text-subheading">Recent Transactions</h3>
      {state.status === "loading" ? (
        <div
          role="status"
          aria-label="Loading recent transactions"
          className="space-y-3"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : state.status === "error" ? (
        <div className="space-y-2">
          <p role="alert" className="text-small text-destructive">
            Unable to load recent purchases.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((current) => current + 1);
            }}
          >
            Retry
          </Button>
        </div>
      ) : state.purchases.length === 0 ? (
        <p className="text-small text-muted-foreground">No purchases yet.</p>
      ) : (
        <ul className="space-y-3">
          {state.purchases.map((purchase) => (
            <li
              key={purchase.id}
              className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-button break-words">{purchase.title}</p>
                <p className="text-small text-muted-foreground">
                  {purchase.kind === "membership" ? "Annual membership" : "Event ticket"}
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-button">
                  {new Intl.NumberFormat("en-CA", {
                    style: "currency",
                    currency: purchase.currency,
                  }).format(purchase.amount_cents / 100)}
                </p>
                <p className="text-small text-muted-foreground">
                  {formatTimestamp(purchase.created_at) ?? "—"}
                </p>
                <p className="text-small capitalize text-muted-foreground">
                  {purchase.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-small text-muted-foreground">
        Competition awards: Under Construction
      </p>
    </section>
  );
}
