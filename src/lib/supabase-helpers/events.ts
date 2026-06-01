import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventInsert, EventRow, EventUpdate } from "@/types/models";

export type EventOrderBy = "start_date" | "created_at";

interface FetchEventsOptions {
  orderBy?: EventOrderBy;
  ascending?: boolean;
}

/** Lists events, ordered by start date ascending by default. */
export async function fetchEvents(
  supabase: DbClient,
  options: FetchEventsOptions = {}
): Promise<EventRow[]> {
  const { orderBy = "start_date", ascending = true } = options;

  const { data, error } = await supabase
    .from(TABLES.events)
    .select("*")
    .order(orderBy, { ascending });

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
  slug: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from(TABLES.events)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

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
  return (data ?? []).map((row) => row.slug);
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

export async function deleteEvent(
  supabase: DbClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from(TABLES.events).delete().eq("id", id);
  if (error) throw error;
}
