import type { DbClient } from "./types";
import { TABLES } from "./tables";
import { eventPresentation } from "@/features/admin/lib/event-presentation";
import { isUuid } from "@/lib/uuid";
import type {
  EventRow,
  EventStatus,
  EventUpdate,
} from "@/lib/supabase/models";

export type EventOrderBy = "starts_at" | "created_at";

interface FetchEventsOptions {
  orderBy?: EventOrderBy;
  ascending?: boolean;
  status?: EventStatus;
  /** Keeps only events in one of these statuses; combine with RLS, never instead of it. */
  statuses?: readonly EventStatus[];
}

interface FetchEventOptions {
  status?: EventStatus;
}

/** Lists events, ordered by start date ascending by default. */
export async function fetchEvents(
  supabase: DbClient,
  options: FetchEventsOptions = {}
): Promise<EventRow[]> {
  const { orderBy = "starts_at", ascending = true, status, statuses } = options;

  let query = supabase
    .from(TABLES.events)
    .select("*")
    .order(orderBy, { ascending });

  if (status) {
    query = query.eq("status", status);
  }
  if (statuses) {
    query = query.in("status", [...statuses]);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(eventPresentation);
}

/**
 * The event Home features: the soonest published, uncanceled event an admin
 * marked "Feature on the portal home" that hasn't ended yet (one in progress
 * still counts, as on the timeline). Null when none qualifies.
 */
export async function fetchFeaturedEvent(
  supabase: DbClient,
  now: Date = new Date()
): Promise<EventRow | null> {
  const at = now.toISOString();
  const { data, error } = await supabase
    .from(TABLES.events)
    .select("*")
    .eq("status", "active")
    .eq("is_featured", true)
    .is("canceled_at", null)
    .or(`ends_at.gte.${at},and(ends_at.is.null,starts_at.gte.${at})`)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? eventPresentation(data) : null;
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
  return data ? eventPresentation(data) : null;
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
  return data ? eventPresentation(data) : null;
}

/** The stored event row by its id or a recorded legacy draft id: canonical IDs
 * and legacy routes share the same permanent event. The id goes into a
 * PostgREST `.or()` filter string, so anything but a UUID is unknown. */
export async function fetchEventRowByIdOrLegacyDraftId(supabase: DbClient, id: string): Promise<EventRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from(TABLES.events).select("*").or(`id.eq.${id},legacy_draft_ids.cs.{${id}}`).maybeSingle();
  if (error) throw error;
  return data;
}

/** The event by its id or a legacy draft id, as the admin pages present it. */
export async function fetchEventByLegacyDraftId(supabase: DbClient, id: string) {
  const row = await fetchEventRowByIdOrLegacyDraftId(supabase, id);
  return row ? eventPresentation(row) : null;
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
  patch: EventSchedulePatch,
  expectedRevision?: number,
  operationId?: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .rpc("update_admin_event_schedule", { p_event_id: id, p_patch: { ...patch, ...(expectedRevision !== undefined ? { _expected_revision: expectedRevision } : {}), ...(operationId ? { _operation_id: operationId } : {}) } })
    .maybeSingle();

  if (error) throw error;
  return data ? eventPresentation(data) : null;
}

/** Staff-only aggregate, including in-flight purchases that lock repricing. */
export async function fetchEventPricingLocked(supabase: DbClient, eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("admin_event_pricing_locked", { p_event_id: eventId });
  if (error) throw error;
  return data;
}
