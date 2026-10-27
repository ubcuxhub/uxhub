import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventRow } from "@/lib/supabase/models";

export interface AdminDashboardStats {
  activeMembers: number;
  upcomingEvents: number;
  upcomingRegistrations: number;
}

export type DashboardEvent = Pick<EventRow,
  "id" | "name" | "slug" | "image_url" | "short_description"
>;

export async function fetchActiveMemberCount(
  db: DbClient, now: string, termEndsAt: string | null,
): Promise<number> {
  // Match hasActiveMembership: a null individual expiry means no ceiling.
  if (termEndsAt && new Date(termEndsAt) <= new Date(now)) return 0;
  const { count, error } = await db.from(TABLES.userInfo)
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("membership_type_id", "is", null)
    .or(`membership_expires_at.is.null,membership_expires_at.gt.${now}`);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchUpcomingEventCount(db: DbClient, now: string): Promise<number> {
  const { count, error } = await db.from(TABLES.events)
    .select("id", { count: "exact", head: true })
    .eq("status", "active").gt("starts_at", now)
    .or(`publish_at.is.null,publish_at.lte.${now}`);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchUpcomingRegistrationCount(db: DbClient, now: string): Promise<number> {
  // Count in Postgres without transferring an unbounded list of event IDs.
  const { count, error } = await db.from(TABLES.eventRegistrations)
    .select("id, events!inner(id)", { count: "exact", head: true })
    .eq("attending", true).eq("events.status", "active")
    .gt("events.starts_at", now)
    .or(`publish_at.is.null,publish_at.lte.${now}`, { referencedTable: "events" });
  if (error) throw error;
  return count ?? 0;
}

export async function fetchNextDashboardEvent(db: DbClient, now: string): Promise<DashboardEvent | null> {
  const { data, error } = await db.from(TABLES.events)
    .select("id, name, slug, image_url, short_description")
    .eq("status", "active").gt("starts_at", now)
    .or(`publish_at.is.null,publish_at.lte.${now}`)
    .order("starts_at").order("id").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchConfirmedEventRegistrationCount(db: DbClient, eventId: string): Promise<number> {
  const { count, error } = await db.from(TABLES.eventRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("attending", true);
  if (error) throw error;
  return count ?? 0;
}
