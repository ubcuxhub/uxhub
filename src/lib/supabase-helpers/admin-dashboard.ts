import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventRow } from "@/lib/supabase/models";

export type DashboardEvent = Pick<EventRow,
  "id" | "name" | "slug" | "image_url" | "short_description" |
  "starts_at" | "location_building" | "location_room" | "location_address_url" | "regular_price" | "member_price"
>;

export async function fetchNextDashboardEvent(db: DbClient, now: string): Promise<DashboardEvent | null> {
  const { data, error } = await db.from(TABLES.events)
    .select("id, name, slug, image_url, short_description, starts_at, location_building, location_room, location_address_url, regular_price, member_price")
    .eq("status", "active").not("starts_at", "is", null)
    .or(`ends_at.gt.${now},and(ends_at.is.null,starts_at.gt.${now})`)
    .order("starts_at").order("id").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchConfirmedEventRegistrationCount(db: DbClient, eventId: string): Promise<number> {
  const { count, error } = await db.from(TABLES.eventTickets)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error) throw error;
  return count ?? 0;
}

/** Complete counts are exact as of the requested time; partial counts are lower
 * bounds for years; partial monthly attribution is provisional until earlier
 * grants are known. Null means unavailable or future, never a fabricated zero. */
export type MembershipCoverage = "complete" | "partial" | "unavailable" | "future";
export interface MembershipHistoryPeriod {
  count: number | null;
  coverage: MembershipCoverage;
}
export interface MembershipHistory {
  latestAcademicYear: number;
  completeFrom: string;
  years: (MembershipHistoryPeriod & {
    academicYear: number;
    label: string;
    months: (MembershipHistoryPeriod & { month: string })[];
  })[];
}
export interface MajorDistribution {
  totalAccounts: number;
  majors: { major: string; count: number }[];
}

export async function fetchMembershipHistory(
  db: DbClient, now: string, range: { firstYear?: number; lastYear?: number } = {},
): Promise<MembershipHistory> {
  const { data, error } = await db.rpc("admin_membership_history", {
    p_now: now, p_first_year: range.firstYear, p_last_year: range.lastYear,
  });
  if (error) throw error;
  return data as unknown as MembershipHistory;
}

export async function fetchMajorDistribution(db: DbClient): Promise<MajorDistribution> {
  const { data, error } = await db.rpc("admin_major_distribution");
  if (error) throw error;
  return data as unknown as MajorDistribution;
}

/** Unique qualifying members awarded in the inclusive [now - 720 hours, now] window. */
export async function fetchRecentMembershipAdditions(db: DbClient, now: string): Promise<MembershipHistoryPeriod> {
  const { data, error } = await db.rpc("admin_recent_membership_additions", { p_now: now });
  if (error) throw error;
  return data as unknown as MembershipHistoryPeriod;
}
