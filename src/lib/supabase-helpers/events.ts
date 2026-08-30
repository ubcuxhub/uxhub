import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventInsert,
  EventRow,
  EventStatus,
  EventUpdate,
} from "@/types/models";

export type EventOrderBy = "start_date" | "created_at";

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
  const { orderBy = "start_date", ascending = true, status } = options;

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

/** Returns existing slugs that start with the given prefix (for uniqueness). */
export async function fetchEventSlugsByPrefix(
  supabase: DbClient,
  prefix: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .select("slug")
    .ilike("slug", `${prefix}%`);

  if (error) throw error;
  return (data ?? [])
    .map((row: Pick<EventRow, "slug">) => row.slug)
    .filter((slug): slug is string => slug !== null);
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

/**
 * Updates an event only while its stored cover image still matches
 * `expectedImageUrl`.
 *
 * Returns `null` when no row matched, which the caller must treat as a
 * conflict rather than retrying unconditionally: another writer replaced the
 * cover (and deleted the object this payload still points at) since the form
 * was loaded, so an unguarded write would leave the row referencing an image
 * that no longer exists.
 */
export async function updateEventIfImageMatches(
  supabase: DbClient,
  id: string,
  payload: EventUpdate,
  expectedImageUrl: string | null
): Promise<{ id: string } | null> {
  const pending = supabase.from(TABLES.events).update(payload).eq("id", id);
  const guarded =
    expectedImageUrl === null
      ? pending.is("image_url", null)
      : pending.eq("image_url", expectedImageUrl);

  const { data, error } = await guarded.select("id").maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Finds an event still referencing `imageUrl`, if any. */
export async function fetchEventIdByImageUrl(
  supabase: DbClient,
  imageUrl: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .select("id")
    .eq("image_url", imageUrl)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}
