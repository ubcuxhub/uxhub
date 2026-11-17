import type { PurchaseRow } from "@/lib/supabase/models";

type PurchaseStatusFields = Pick<PurchaseRow, "status" | "amount_cents" | "refunded_cents">;

/** True once completed refunds cover a paid purchase's whole amount. */
export function isFullyRefunded(
  purchase: Pick<PurchaseRow, "amount_cents" | "refunded_cents">
): boolean {
  return purchase.amount_cents > 0 && purchase.refunded_cents >= purchase.amount_cents;
}

/**
 * "Refunded" or "Partially refunded" once Square has completed a refund, or
 * null. `status` keeps mirroring Square's payment (still completed after a
 * refund), so a refund shows through the recorded amount instead.
 */
export function purchaseRefundLabel(
  purchase: Pick<PurchaseRow, "amount_cents" | "refunded_cents">
): "Refunded" | "Partially refunded" | null {
  if (purchase.refunded_cents <= 0 || purchase.amount_cents <= 0) return null;
  return isFullyRefunded(purchase) ? "Refunded" : "Partially refunded";
}

/** What a purchase's state reads as: its refund, or its capitalized status. */
export function purchaseStatusLabel(purchase: PurchaseStatusFields): string {
  return (
    purchaseRefundLabel(purchase) ??
    `${purchase.status.charAt(0).toUpperCase()}${purchase.status.slice(1)}`
  );
}
