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
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  billingPostalCode?: string | null;
  verificationToken?: string | null;
}

export interface CheckoutActionSuccess {
  ok: true;
  purchaseId: string;
  redirectTo: string;
  resolution: "completed" | "processing";
}

export interface CheckoutActionFailure {
  ok: false;
  error: string;
  /**
   * True only when the server knows this attempt cannot later settle. Ambiguous
   * failures keep their idempotency key so a retry reconciles instead of
   * creating another charge.
   */
  terminal: boolean;
}

export type CheckoutActionResult =
  | CheckoutActionSuccess
  | CheckoutActionFailure;
