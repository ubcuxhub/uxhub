import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/log";
import { FLAGS } from "@/lib/flags";
import {
  fetchNextDashboardEvent,
  fetchMembershipHistory, fetchMajorDistribution, fetchRecentMembershipAdditions,
} from "@/lib/supabase-helpers/admin-dashboard";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import { DashboardAreaOfStudy } from "./DashboardAreaOfStudy";
import { DashboardClubMembers } from "./DashboardClubMembers";
import { DashboardEventUnavailable, DashboardUpcomingEvent } from "./DashboardUpcomingEvent";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";

async function readDashboardData<T>(metric: string, read: () => Promise<T>): Promise<T | null> {
  const started = performance.now();
  try {
    return await read();
  } catch (error) {
    log.error("admin.dashboard_query_failed", { metric, ...errorFields(error) });
    return null;
  } finally {
    log.info("admin.dashboard_query_completed", { metric, durationMs: Math.round(performance.now() - started) });
  }
}

export async function DashboardMajorData() {
  const db = await createClient();
  const data = await readDashboardData("major_distribution", () => fetchMajorDistribution(db));
  return <DashboardAreaOfStudy data={data} />;
}

export async function DashboardMembershipData({ now }: { now: string }) {
  const db = await createClient();
  const [data, recentAdditions] = await Promise.all([
    readDashboardData("membership_history", () => fetchMembershipHistory(db, now)),
    readDashboardData("recent_membership_additions", () => fetchRecentMembershipAdditions(db, now)),
  ]);
  return <DashboardClubMembers data={data} recentAdditions={recentAdditions} />;
}

export function DashboardStats({ now }: { now: string }) {
  return <div className="min-w-0 space-y-5">
    <Suspense fallback={<StatisticsCard title="Area of Study" size="compact" loading />}><DashboardMajorData /></Suspense>
    <Suspense fallback={<StatisticsCard title="Club Members" loading />}><DashboardMembershipData now={now} /></Suspense>
  </div>;
}

export async function DashboardEventData({ now }: { now: string }) {
  const db = await createClient();
  // An envelope distinguishes an empty result from a failed query.
  const result = await readDashboardData("next_event", async () => ({ event: await fetchNextDashboardEvent(db, now) }));
  if (!result) return <DashboardEventUnavailable failed />;
  const event = result.event;
  const counts = event
    ? await readDashboardData("event_seats", () => fetchEventSeatCounts(db, [event.id]))
    : null;
  return <DashboardUpcomingEvent event={event} seats={event ? counts?.get(event.id) ?? null : null} showStudentLink={FLAGS.studentEvents} now={now} />;
}
