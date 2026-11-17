import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { purchaseRefundLabel } from "@/features/payments/purchase-status";
import type { UserPurchaseSummary } from "../types";

/** How many purchases a user record lists. */
export const RECENT_PURCHASE_LIMIT = 5;

/**
 * Only what the record shows: payment and customer ids and failure reasons
 * stay on the server.
 */
export function toUserPurchaseSummary(purchase: PurchaseWithDetails): UserPurchaseSummary {
  return {
    id: purchase.id,
    title:
      purchase.kind === "membership"
        ? purchase.membership_types?.name
          ? formatMembershipTypeName(purchase.membership_types.name)
          : "Membership purchase"
        : purchase.events?.name || "Event ticket",
    kind: purchase.kind,
    amount_cents: purchase.amount_cents,
    refunded_cents: purchase.refunded_cents,
    currency: purchase.currency,
    status: purchase.status,
    created_at: purchase.created_at,
  };
}

/**
 * "Annual membership", or "Event ticket · Failed" for anything not completed,
 * and "· Refunded" or "· Partially refunded" once Square refunded it.
 */
export function describeUserPurchase(
  purchase: Pick<UserPurchaseSummary, "kind" | "status" | "amount_cents" | "refunded_cents">
): string {
  const kind = purchase.kind === "membership" ? "Annual membership" : "Event ticket";
  const refund = purchaseRefundLabel(purchase);
  if (refund) return `${kind} · ${refund}`;
  if (!purchase.status || purchase.status === "completed") return kind;
  return `${kind} · ${purchase.status.charAt(0).toUpperCase()}${purchase.status.slice(1)}`;
}
