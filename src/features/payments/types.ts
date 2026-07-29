export type PurchaseKind = "event_ticket" | "membership";

export type PurchaseStatus =
  | "pending"
  | "authorized"
  | "completed"
  | "canceled"
  | "failed";

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
