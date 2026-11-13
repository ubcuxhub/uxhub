import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventInsert,
  EventRow,
  EventStatus,
  EventUpdate,
} from "@/lib/supabase/models";

export type EventOrderBy = "starts_at" | "created_at";

interface FetchEventsOptions {
  orderBy?: EventOrderBy;
  ascending?: boolean;
  status?: EventStatus;
}

interface FetchEventOptions {
  status?: EventStatus;
}

/** Lists events, ordered by start date ascending by default. */
export async function fetchEvents(
  supabase: DbClient,
  options: FetchEventsOptions = {}
): Promise<EventRow[]> {
  const { orderBy = "starts_at", ascending = true, status } = options;

  let query = supabase
    .from(TABLES.events)
    .select("*")
    .order(orderBy, { ascending });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function fetchEventById(
  supabase: DbClient,
  id: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchEventBySlug(
  supabase: DbClient,
  slug: string,
  options: FetchEventOptions = {}
): Promise<EventRow | null> {
  const { status } = options;
  let query = supabase
    .from(TABLES.events)
    .select("*")
    .eq("slug", slug);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Returns the event URLs starting with `prefix` (for uniqueness): every
 * event's `slug` and every URL claimed in `event_url_claims`, which also holds
 * each event's configured page URL. Pass `exceptEventId` to leave out that
 * event's own URLs, so re-saving it does not count them as taken.
 *
 * Needs the service-role client: `event_url_claims` has no browser grants.
 */
export async function fetchEventSlugsByPrefix(
  supabase: DbClient,
  prefix: string,
  options: { exceptEventId?: string | null } = {}
): Promise<string[]> {
  const { exceptEventId } = options;
  let events = supabase
    .from(TABLES.events)
    .select("slug")
    .ilike("slug", `${prefix}%`);
  let claims = supabase
    .from(TABLES.eventUrlClaims)
    .select("slug")
    .ilike("slug", `${prefix}%`);
  if (exceptEventId) {
    events = events.neq("id", exceptEventId);
    claims = claims.neq("event_id", exceptEventId);
  }

  const [eventsResult, claimsResult] = await Promise.all([events, claims]);
  if (eventsResult.error) throw eventsResult.error;
  if (claimsResult.error) throw claimsResult.error;
  const slugs = [...eventsResult.data, ...claimsResult.data]
    .map((row: { slug: string | null }) => row.slug)
    .filter((slug): slug is string => slug !== null);
  return [...new Set(slugs)];
}

export async function insertEvent(
  supabase: DbClient,
  payload: EventInsert
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("No event id returned from Supabase.");
  return data;
}

export async function updateEvent(
  supabase: DbClient,
  id: string,
  payload: EventUpdate
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .update(payload)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("No event id returned from Supabase.");
  return data;
}

/** The columns the admin overview's quick edit changes. */
export type EventSchedulePatch = Pick<
  EventUpdate,
  | "status"
  | "publish_at"
  | "starts_at"
  | "ends_at"
  | "registration_opens_at"
  | "registration_closes_at"
>;

/**
 * Writes an event's status and dates and returns the saved row, or null when
 * no row was written: the event is gone, or RLS refused the caller.
 *
 * Pass the signed-in admin's client, not the service role, so the database
 * sees who made the change (the audit log reads `auth.uid()`).
 */
export async function updateEventSchedule(
  supabase: DbClient,
  id: string,
  patch: EventSchedulePatch
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .rpc("update_admin_event_schedule", { p_event_id: id, p_patch: patch })
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Staff-only aggregate, including in-flight purchases that lock repricing. */
export async function fetchEventPricingLocked(supabase: DbClient, eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("admin_event_pricing_locked", { p_event_id: eventId });
  if (error) throw error;
  return data;
}
