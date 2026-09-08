import type { PurchaseRow } from "@/types/models";
import type { CheckoutActionResult } from "./types";
import { getPurchaseRedirectPath } from "./fulfillment-rules";

type ExistingCheckoutPurchase = Pick<
  PurchaseRow,
  "failure_reason" | "id" | "status" | "user_id"
>;

export function getExistingCheckoutResult(
  purchase: ExistingCheckoutPurchase,
  userId: string,
): CheckoutActionResult {
  if (purchase.user_id !== userId) {
    return {
      ok: false,
      error: "This checkout attempt belongs to a different account.",
      terminal: false,
    };
  }

  if (purchase.status === "failed" || purchase.status === "canceled") {
    return {
      ok: false,
      error:
        purchase.failure_reason ||
        "Your previous checkout attempt did not complete. Please try again.",
      terminal: true,
    };
  }

  return {
    ok: true,
    purchaseId: purchase.id,
    redirectTo: getPurchaseRedirectPath(),
    resolution:
      purchase.status === "completed" ? "completed" : "processing",
  };
}
