import { IdCard, Ticket } from "lucide-react";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { formatEventDate } from "@/lib/date";

import { describeUserPurchase } from "../lib/user-purchases";
import type { UserPurchaseSummary } from "../types";

/** A user's most recent purchases, newest first, as charges. */
export function UserTransactionList({ purchases }: { purchases: UserPurchaseSummary[] }) {
  if (purchases.length === 0) {
    return <p className="text-body text-muted-foreground">No purchases yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {purchases.map((purchase) => (
        <li key={purchase.id}>
          <TransactionRow
            title={purchase.title}
            description={describeUserPurchase(purchase)}
            amountCents={-purchase.amount_cents}
            currency={purchase.currency}
            date={formatEventDate(purchase.created_at, { month: "short" }) ?? "Date unknown"}
            media={
              purchase.kind === "membership" ? (
                <IdCard className="size-5 text-muted-foreground" />
              ) : (
                <Ticket className="size-5 text-muted-foreground" />
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
