import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/log";
import { FLAGS } from "@/lib/flags";
import {
  fetchConfirmedEventRegistrationCount, fetchNextDashboardEvent,
  fetchMembershipAnalytics, fetchEventAnalytics,
} from "@/lib/supabase-helpers/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStatsCarousel } from "./DashboardStatsCarousel";
import { DashboardUpcomingEvent } from "./DashboardUpcomingEvent";
import { DashboardPanel } from "./DashboardPanel";

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

export function DashboardStatsSkeleton() {
  return <div role="status" aria-label="Loading statistics"><DashboardPanel className="min-h-[480px] gap-6"><Skeleton className="h-7 w-28" /><Skeleton className="mx-auto size-52 rounded-full" /><Skeleton className="h-16 w-full" /></DashboardPanel></div>;
}

export async function DashboardStats({ now }: { now: string }) {
  const db = await createClient();
  const [members, events] = await Promise.all([
    readDashboardData("membership_analytics", () => fetchMembershipAnalytics(db, now)),
    readDashboardData("event_analytics", () => fetchEventAnalytics(db, now)),
  ]);
  return <DashboardStatsCarousel members={members} events={events} />;
}

export async function DashboardEventData({ now }: { now: string }) {
  const db = await createClient();
  // An envelope distinguishes an empty result from a failed query.
  const result = await readDashboardData("next_event", async () => ({ event: await fetchNextDashboardEvent(db, now) }));
  if (!result) return <DashboardPanel className="min-h-64 items-center justify-center"><p className="text-small text-fg-secondary">Upcoming event unavailable. Please try again later.</p></DashboardPanel>;
  const event = result.event;
  const rsvpCount = event
    ? await readDashboardData("event_rsvps", () => fetchConfirmedEventRegistrationCount(db, event.id))
    : null;
  return <DashboardUpcomingEvent event={event} rsvpCount={rsvpCount} showStudentLink={FLAGS.studentEvents} />;
}
