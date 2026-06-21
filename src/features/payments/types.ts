export const PURCHASE_KINDS = ["event_ticket", "membership"] as const;
export type PurchaseKind = (typeof PURCHASE_KINDS)[number];

export const PURCHASE_STATUSES = [
  "pending",
  "authorized",
  "completed",
  "canceled",
  "failed",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface CheckoutRequestInput {
  kind: PurchaseKind;
  slug: string;
  token: string;
  idempotencyKey: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  billingPostalCode?: string | null;
}

export interface CheckoutActionSuccess {
  ok: true;
  purchaseId: string;
  redirectTo: string;
}

export interface CheckoutActionFailure {
  ok: false;
  error: string;
}

export type CheckoutActionResult =
  | CheckoutActionSuccess
  | CheckoutActionFailure;
