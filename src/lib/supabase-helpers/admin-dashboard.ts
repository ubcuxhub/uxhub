import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventRow } from "@/lib/supabase/models";

export interface MembershipAnalytics {
  activeMembers: number;
  buyersLast30Days: number;
  tiers: { id: string; name: string; count: number }[];
}

export interface EventAnalyticsRow {
  id: string;
  name: string;
  startsAt: string;
  registrations: number;
  attendees: number;
}

export interface EventAnalytics {
  events: EventAnalyticsRow[];
  currentEvent: { id: string; name: string; registrations: number } | null;
  schoolYearLabel: string;
  uniqueParticipants: number;
}

export async function fetchMembershipAnalytics(db: DbClient, now: string): Promise<MembershipAnalytics> {
  const { data, error } = await db.rpc("admin_membership_analytics", { p_now: now });
  if (error) throw error;
  // These JSON contracts are owned by the matching migration and exercised
  // against Postgres in the integration suite. RPC Json cannot express them.
  return data as unknown as MembershipAnalytics;
}

export async function fetchEventAnalytics(db: DbClient, now: string): Promise<EventAnalytics> {
  const { data, error } = await db.rpc("admin_event_analytics", { p_now: now });
  if (error) throw error;
  return data as unknown as EventAnalytics;
}

export type DashboardEvent = Pick<EventRow,
  "id" | "name" | "slug" | "image_url" | "short_description" |
  "start_date" | "location_building" | "location_room" | "location_address_url" | "regular_price" | "member_price"
>;

export async function fetchNextDashboardEvent(db: DbClient, now: string): Promise<DashboardEvent | null> {
  const { data, error } = await db.from(TABLES.events)
    .select("id, name, slug, image_url, short_description, start_date, location_building, location_room, location_address_url, regular_price, member_price")
    .eq("status", "active").not("starts_at", "is", null)
    .or(`ends_at.gt.${now},and(ends_at.is.null,starts_at.gt.${now})`)
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
