import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventRow,
  MembershipTypeRow,
  PurchaseInsert,
  PurchaseRow,
  PurchaseUpdate,
  SquareWebhookEventInsert,
} from "@/types/models";

export interface PurchaseWithDetails extends PurchaseRow {
  events: Pick<EventRow, "id" | "name" | "slug" | "start_date"> | null;
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

export async function fetchPurchasesForUser(
  supabase: DbClient,
  userId: string
): Promise<PurchaseWithDetails[]> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select(
      `
      *,
      events (id, name, slug, start_date),
      membership_types (id, name, slug)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

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
      events (id, name, slug, start_date),
      membership_types (id, name, slug)
    `
    )
    .eq("user_id", userId)
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) throw error;
  return (data as PurchaseWithDetails | null) ?? null;
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
