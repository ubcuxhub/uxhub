import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventRow,
  MembershipTypeRow,
  PurchaseInsert,
  PurchaseRow,
  PurchaseUpdate,
  SquareWebhookEventInsert,
} from "@/lib/supabase/models";

export interface PurchaseWithDetails extends PurchaseRow {
  events: Pick<EventRow, "id" | "name" | "slug" | "starts_at"> | null;
  membership_types: Pick<MembershipTypeRow, "id" | "name" | "slug"> | null;
}

export async function createPurchase(
  supabase: DbClient,
  payload: PurchaseInsert
): Promise<PurchaseRow> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPurchaseById(
  supabase: DbClient,
  purchaseId: string
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchPurchaseByIdempotencyKey(
  supabase: DbClient,
  idempotencyKey: string
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchPurchaseBySquarePaymentId(
  supabase: DbClient,
  squarePaymentId: string
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("square_payment_id", squarePaymentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchNonterminalMembershipPurchase(
  supabase: DbClient,
  userId: string,
  membershipTypeId: string,
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "membership")
    .eq("membership_type_id", membershipTypeId)
    .in("status", ["pending", "authorized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updatePurchase(
  supabase: DbClient,
  purchaseId: string,
  payload: PurchaseUpdate
): Promise<PurchaseRow> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .update(payload)
    .eq("id", purchaseId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Atomically reserves the one allowed confirmation-email attempt for a
 * completed purchase. A null result means another request already claimed or
 * completed the send, or the purchase is no longer eligible.
 */
export async function claimPurchaseConfirmationEmail(
  supabase: DbClient,
  purchaseId: string
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .update({ confirmation_email_attempted_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "completed")
    .is("confirmation_email_attempted_at", null)
    .is("confirmation_email_sent_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Hands the claim back when a send fails, so a later fulfillment pass may try
 * again. Scoped to rows that never sent, so a successful send is never undone.
 */
export async function releasePurchaseConfirmationEmailClaim(
  supabase: DbClient,
  purchaseId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.purchases)
    .update({ confirmation_email_attempted_at: null })
    .eq("id", purchaseId)
    .is("confirmation_email_sent_at", null);

  if (error) throw error;
}

/** One completed Square refund on a purchase, as its email is tracked. */
export interface PurchaseRefundEmailInput {
  squareRefundId: string;
  purchaseId: string;
  /** This refund's amount, not the purchase's running total. */
  amountCents: number;
  currency: string;
}

/**
 * Atomically reserves the one allowed email for a completed refund. The row
 * is created on first sight (a duplicate insert is ignored), then claimed by
 * setting `email_attempted_at` where it is still unset, which only one caller
 * can win. False when another pass already claimed or sent it. Service role
 * only.
 */
export async function claimPurchaseRefundEmail(
  supabase: DbClient,
  input: PurchaseRefundEmailInput
): Promise<boolean> {
  const { error: insertError } = await supabase
    .from(TABLES.purchaseRefundEmails)
    .upsert(
      {
        square_refund_id: input.squareRefundId,
        purchase_id: input.purchaseId,
        amount_cents: input.amountCents,
        currency: input.currency,
      },
      { onConflict: "square_refund_id", ignoreDuplicates: true }
    );

  if (insertError) throw insertError;

  const { data, error } = await supabase
    .from(TABLES.purchaseRefundEmails)
    .update({ email_attempted_at: new Date().toISOString() })
    .eq("square_refund_id", input.squareRefundId)
    .eq("purchase_id", input.purchaseId)
    .is("email_attempted_at", null)
    .is("email_sent_at", null)
    .select("square_refund_id")
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Hands a refund email's claim back when the send did not happen, so a later
 * webhook pass may try again. Never undoes a send that went out.
 */
export async function releasePurchaseRefundEmailClaim(
  supabase: DbClient,
  squareRefundId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.purchaseRefundEmails)
    .update({ email_attempted_at: null })
    .eq("square_refund_id", squareRefundId)
    .is("email_sent_at", null);

  if (error) throw error;
}

/** Records that a refund's email went out. */
export async function markPurchaseRefundEmailSent(
  supabase: DbClient,
  squareRefundId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.purchaseRefundEmails)
    .update({ email_sent_at: new Date().toISOString() })
    .eq("square_refund_id", squareRefundId);

  if (error) throw error;
}

export async function fetchPurchasesForUser(
  supabase: DbClient,
  userId: string,
  limit?: number
): Promise<PurchaseWithDetails[]> {
  let query = supabase
    .from(TABLES.purchases)
    .select(
      `
      *,
      events (id, name, slug, starts_at),
      membership_types (id, name, slug)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (limit !== undefined) query = query.limit(limit);
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as PurchaseWithDetails[];
}

export async function fetchPurchaseForUser(
  supabase: DbClient,
  userId: string,
  purchaseId: string
): Promise<PurchaseWithDetails | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select(
      `
      *,
      events (id, name, slug, starts_at),
      membership_types (id, name, slug)
    `
    )
    .eq("user_id", userId)
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) throw error;
  return (data as PurchaseWithDetails | null) ?? null;
}

/** What `apply_event_purchase_refund` recorded and did. */
export interface PurchaseRefundResult {
  /** The refunded total now on the purchase. It never goes down. */
  refundedCents: number;
  fullyRefunded: boolean;
  /** False for a duplicate or stale delivery that changed nothing. */
  amountIncreased: boolean;
  ticketRemoved: boolean;
  /** A full refund left the ticket alone because it has a check-in. */
  keptCheckedInTicket: boolean;
}

/**
 * Records the total of a purchase's completed Square refunds through
 * `apply_event_purchase_refund`, which takes back the ticket of an event
 * purchase refunded in full unless it was checked in. Pass only completed
 * refunds: a pending one must not remove access. Null for an unknown
 * purchase. Service role only.
 */
export async function applyPurchaseRefund(
  supabase: DbClient,
  purchaseId: string,
  refundedCents: number
): Promise<PurchaseRefundResult | null> {
  const { data, error } = await supabase.rpc("apply_event_purchase_refund", {
    p_purchase_id: purchaseId,
    p_refunded_cents: refundedCents,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    refundedCents: row.refunded_total_cents,
    fullyRefunded: row.fully_refunded,
    amountIncreased: row.amount_increased,
    ticketRemoved: row.ticket_removed,
    keptCheckedInTicket: row.kept_checked_in_ticket,
  };
}

export async function recordSquareWebhookEvent(
  supabase: DbClient,
  payload: SquareWebhookEventInsert
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .insert(payload);

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return false;
  }

  throw error;
}

/**
 * Undoes `recordSquareWebhookEvent` after processing fails, so Square's retry
 * of the same event is processed instead of discarded as a duplicate.
 */
export async function forgetSquareWebhookEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .delete()
    .eq("event_id", eventId);

  if (error) throw error;
}
