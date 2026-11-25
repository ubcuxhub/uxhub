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

/**
 * The user's membership purchase that may still take money (pending or
 * authorized), whatever the tier. At most one exists:
 * `purchases_one_live_membership_per_user` refuses a second.
 */
export async function fetchLiveMembershipPurchase(
  supabase: DbClient,
  userId: string,
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "membership")
    .in("status", ["pending", "authorized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** A Postgres unique violation, as PostgREST reports it. */
export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
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

/** The values `purchases.status` allows (a check constraint, so typed as text). */
type PurchaseStatus = "pending" | "authorized" | "completed" | "canceled" | "failed";

/**
 * The stored statuses a Square payment status may replace. Square does not
 * promise to deliver webhooks in order, so an older `payment.updated` can
 * arrive after a newer one: a status only moves forward. Completed is final,
 * and only a completion moves a purchase out of canceled or failed, because
 * the app also fails attempts Square never saw (`fail_abandoned_purchases`)
 * and Square's completed payment must still win then.
 */
const SQUARE_STATUS_FROM: Record<PurchaseStatus, PurchaseStatus[]> = {
  pending: ["pending"],
  authorized: ["pending", "authorized"],
  completed: ["pending", "authorized", "completed", "canceled", "failed"],
  canceled: ["pending", "authorized", "canceled", "failed"],
  failed: ["pending", "authorized", "canceled", "failed"],
};

/**
 * Records a Square payment's state on its purchase, unless the purchase has
 * already moved past it (see `SQUARE_STATUS_FROM`). The guard is part of the
 * UPDATE, so two deliveries racing can't undo each other. Returns the row as
 * it now stands and whether this call changed it.
 */
export async function applySquarePaymentStatus(
  supabase: DbClient,
  purchaseId: string,
  payment: {
    status: PurchaseStatus;
    squarePaymentId: string | null;
    squareCustomerId: string | null;
  },
): Promise<{ purchase: PurchaseRow; applied: boolean }> {
  const update: PurchaseUpdate = { status: payment.status };
  if (payment.squarePaymentId) update.square_payment_id = payment.squarePaymentId;
  if (payment.squareCustomerId) update.square_customer_id = payment.squareCustomerId;
  // A failure keeps the reason the app recorded; anything else clears it.
  if (payment.status !== "canceled" && payment.status !== "failed") {
    update.failure_reason = null;
  }

  const { data, error } = await supabase
    .from(TABLES.purchases)
    .update(update)
    .eq("id", purchaseId)
    .in("status", SQUARE_STATUS_FROM[payment.status])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return { purchase: data, applied: true };
  const current = await fetchPurchaseById(supabase, purchaseId);
  if (!current) throw new Error("Purchase not found while recording its payment.");
  return { purchase: current, applied: false };
}

/**
 * Fails a purchase still pending with no Square payment ID once it is older
 * than `createdBefore`, so the buyer can try again and an event no longer
 * counts it as a payment in flight. Null when it no longer qualifies (a
 * webhook recorded its payment meanwhile, or it settled).
 */
export async function failAbandonedPurchase(
  supabase: DbClient,
  purchaseId: string,
  createdBefore: string,
  reason: string,
): Promise<PurchaseRow | null> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .update({ status: "failed", failure_reason: reason })
    .eq("id", purchaseId)
    .eq("status", "pending")
    .is("square_payment_id", null)
    .lt("created_at", createdBefore)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Stamps `fulfilled_at` on a purchase whose entitlement was just granted.
 * Scoped to an unfulfilled row, so a concurrent pass never moves the stamp.
 */
export async function markPurchaseFulfilled(
  supabase: DbClient,
  purchaseId: string,
): Promise<PurchaseRow> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .is("fulfilled_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data;
  const current = await fetchPurchaseById(supabase, purchaseId);
  if (!current) throw new Error("Purchase not found while marking it fulfilled.");
  return current;
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The user's purchase with its event or tier, or null. An ID that isn't a
 * UUID (a mangled confirmation link) is null too, rather than the error
 * Postgres raises comparing it with a uuid column.
 */
export async function fetchPurchaseForUser(
  supabase: DbClient,
  userId: string,
  purchaseId: string
): Promise<PurchaseWithDetails | null> {
  if (!UUID_PATTERN.test(purchaseId)) return null;

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

/**
 * How long a claimed webhook event may go unprocessed before another delivery
 * takes it over: the handler that claimed it was killed (a timeout, a crash)
 * without forgetting it. Comfortably longer than a request may run.
 */
export const SQUARE_WEBHOOK_CLAIM_STALE_MS = 5 * 60 * 1000;

/**
 * `claimed`: this delivery handles the event. `processed`: an earlier one
 * already did. `in_progress`: another delivery is handling it right now, so
 * this one should ask Square to retry rather than acknowledge it.
 */
export type SquareWebhookClaim = "claimed" | "processed" | "in_progress";

type SquareWebhookEventClaimInput = Pick<
  SquareWebhookEventInsert,
  "event_id" | "event_type" | "square_payment_id"
>;

async function insertSquareWebhookClaim(
  supabase: DbClient,
  event: SquareWebhookEventClaimInput
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .insert({ ...event, processed_at: null });

  if (!error) return true;
  if (isUniqueViolation(error)) return false;
  throw error;
}

/**
 * Claims a webhook event for processing. The row is written before handling
 * so concurrent deliveries are handled once; it is stamped processed by
 * `markSquareWebhookEventProcessed`, or deleted by `forgetSquareWebhookEvent`
 * when handling fails. Only the event ID, type and payment ID are kept, never
 * the payload. A claim left unprocessed for `SQUARE_WEBHOOK_CLAIM_STALE_MS`
 * is taken over.
 */
export async function claimSquareWebhookEvent(
  supabase: DbClient,
  event: SquareWebhookEventClaimInput,
  now = Date.now()
): Promise<SquareWebhookClaim> {
  if (await insertSquareWebhookClaim(supabase, event)) return "claimed";

  const { data: existing, error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .select("processed_at, created_at")
    .eq("event_id", event.event_id)
    .maybeSingle();

  if (error) throw error;
  // Forgotten in between: the delivery that held it failed.
  if (!existing) {
    return (await insertSquareWebhookClaim(supabase, event)) ? "claimed" : "in_progress";
  }
  if (existing.processed_at) return "processed";

  const claimedAt = existing.created_at ? Date.parse(existing.created_at) : Number.NaN;
  if (Number.isFinite(claimedAt) && now - claimedAt < SQUARE_WEBHOOK_CLAIM_STALE_MS) {
    return "in_progress";
  }

  // A stale claim: drop it (only if it is still that same claim) and race
  // any other delivery for a fresh one.
  let stale = supabase
    .from(TABLES.squareWebhookEvents)
    .delete()
    .eq("event_id", event.event_id)
    .is("processed_at", null);
  stale = existing.created_at
    ? stale.eq("created_at", existing.created_at)
    : stale.is("created_at", null);
  const { error: deleteError } = await stale;
  if (deleteError) throw deleteError;

  return (await insertSquareWebhookClaim(supabase, event)) ? "claimed" : "in_progress";
}

/** Marks a claimed webhook event as handled, so later deliveries skip it. */
export async function markSquareWebhookEventProcessed(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) throw error;
}

/**
 * Releases a claim after processing fails, so Square's retry of the same
 * event is processed instead of discarded as a duplicate. Never removes an
 * event already processed.
 */
export async function forgetSquareWebhookEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.squareWebhookEvents)
    .delete()
    .eq("event_id", eventId)
    .is("processed_at", null);

  if (error) throw error;
}
