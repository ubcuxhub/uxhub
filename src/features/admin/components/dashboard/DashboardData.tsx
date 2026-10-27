import { CalendarDays, Ticket, Users } from "lucide-react";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/log";
import { FLAGS } from "@/lib/flags";
import {
  fetchActiveMemberCount, fetchConfirmedEventRegistrationCount,
  fetchNextDashboardEvent, fetchUpcomingEventCount, fetchUpcomingRegistrationCount,
  type AdminDashboardStats,
} from "@/lib/supabase-helpers/admin-dashboard";
import { DashboardStatCard } from "./DashboardStatCard";
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

const metrics = [
  { key: "activeMembers", label: "Active members", icon: Users },
  { key: "upcomingEvents", label: "Upcoming events", icon: CalendarDays },
  { key: "upcomingRegistrations", label: "Upcoming registrations", icon: Ticket },
] as const;

export function DashboardStatsSkeleton() {
  return <div role="status" aria-label="Loading statistics" className="space-y-4">{metrics.map(({ key, ...metric }) => <DashboardStatCard key={key} {...metric} loading />)}</div>;
}

export async function DashboardStats({ now }: { now: string }) {
  const db = await createClient();
  const [activeMembers, upcomingEvents, upcomingRegistrations] = await Promise.all([
    readDashboardData("active_members", async () => fetchActiveMemberCount(db, now, await getMembershipTermEndsAt())),
    readDashboardData("upcoming_events", () => fetchUpcomingEventCount(db, now)),
    readDashboardData("upcoming_registrations", () => fetchUpcomingRegistrationCount(db, now)),
  ]);
  const stats: { [K in keyof AdminDashboardStats]: number | null } = { activeMembers, upcomingEvents, upcomingRegistrations };
  return <div className="space-y-4">{metrics.map(({ key, ...metric }) => <DashboardStatCard key={key} {...metric} value={stats[key]} />)}</div>;
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
