export type PurchaseKind = "event_ticket" | "membership";

/**
 * What the checkout form sends. The buyer's name, email and phone are not
 * part of it: the server reads them from the signed-in profile.
 */
export interface CheckoutRequestInput {
  kind: PurchaseKind;
  slug: string;
  /** The card token; absent for a free ticket or membership. */
  token?: string | null;
  /** The amount the buyer saw and verified, checked against the server's. */
  expectedAmountCents?: number;
  idempotencyKey: string;
  verificationToken?: string | null;
}

export interface CheckoutActionSuccess {
  ok: true;
  purchaseId: string;
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
