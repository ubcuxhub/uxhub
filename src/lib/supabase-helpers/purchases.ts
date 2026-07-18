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

type EventPurchaseSummary = Pick<PurchaseRow, "id" | "status">;

const SUCCESSFUL_EVENT_PURCHASE_DELETE_WARNING =
  "Unable to delete the event, there exists successful user purchases relating to the event. Please contact the development team for assistance.";

const SUCCESSFUL_PURCHASE_STATUSES = new Set(["authorized", "completed"]);

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

async function fetchEventPurchaseSummaries(
  supabase: DbClient,
  eventId: string
): Promise<EventPurchaseSummary[]> {
  const { data, error } = await supabase
    .from(TABLES.purchases)
    .select("id, status")
    .eq("event_id", eventId);

  if (error) throw error;
  return data ?? [];
}

function assertOnlyFailedPurchases(purchases: EventPurchaseSummary[]): void {
  const hasSuccessfulPurchase = purchases.some((purchase) =>
    SUCCESSFUL_PURCHASE_STATUSES.has(purchase.status)
  );

  if (hasSuccessfulPurchase) {
    throw new Error(SUCCESSFUL_EVENT_PURCHASE_DELETE_WARNING);
  }

  const hasBlockingPurchase = purchases.some(
    (purchase) => purchase.status !== "failed"
  );

  if (hasBlockingPurchase) {
    throw new Error(
      "This event has purchases that are not failed, so it cannot be deleted."
    );
  }
}

export async function ensureEventPurchasesAreDeletable(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const purchases = await fetchEventPurchaseSummaries(supabase, eventId);
  assertOnlyFailedPurchases(purchases);
}

export async function deleteFailedPurchasesForEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const purchases = await fetchEventPurchaseSummaries(supabase, eventId);
  if (purchases.length === 0) return;

  assertOnlyFailedPurchases(purchases);

  const purchaseIds = purchases.map((purchase) => purchase.id);
  const { error: deleteError } = await supabase
    .from(TABLES.purchases)
    .delete()
    .in("id", purchaseIds);

  if (deleteError) throw deleteError;
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
