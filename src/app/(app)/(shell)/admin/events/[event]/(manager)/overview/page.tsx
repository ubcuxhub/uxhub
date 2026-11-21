import { notFound } from "next/navigation";

import { EventOverview } from "@/features/admin/components/event-manager/EventOverview";
import { eventNeedsAction } from "@/features/admin/lib/event-needs-action";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchCheckInAttendees, fetchCheckInStatuses } from "@/lib/supabase-helpers/check-ins";
import { fetchEventApplicationSettings } from "@/lib/supabase-helpers/event-application-settings";
import { fetchSubmittedApplicationCounts } from "@/lib/supabase-helpers/event-application-review-counts";
import { fetchEventLifecycleCounts } from "@/lib/supabase-helpers/event-lifecycle";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";

/**
 * The event manager's Overview tab (`/admin/events/<id>/overview`): what
 * needs action, who registered, the registration numbers, and the event's
 * details with the quick edit of its status and schedule.
 */
export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(supabase, eventParam, "/overview");

  const [event, seatCounts, attendees, checkIns] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchEventSeatCounts(supabase, [eventId]),
    fetchCheckInAttendees(supabase, eventId),
    fetchCheckInStatuses(supabase, eventId),
  ]);
  if (!event) notFound();

  const [toReview, applicationSettings, lifecycle] = await Promise.all([
    event.requires_application ? fetchSubmittedApplicationCounts(supabase, [eventId]) : null,
    event.requires_application ? fetchEventApplicationSettings(supabase, eventId) : null,
    // Paid tickets are counted by a service-role function, as the cancel dialog does.
    event.canceled_at ? fetchEventLifecycleCounts(supabaseAdmin, eventId) : null,
  ]);

  const seats = seatCounts.get(eventId);
  const now = new Date();

  return (
    <EventOverview
      event={event}
      seats={{
        tickets: seats?.tickets ?? 0,
        seatsLeft: seats?.seatsLeft ?? event.max_capacity,
      }}
      checkedIn={countCheckedIn(attendees, checkIns)}
      registrations={attendees.map((attendee) => ({ id: attendee.id, name: attendee.user_name }))}
      needsAction={eventNeedsAction(
        {
          event,
          applicationsToReview: toReview?.get(eventId) ?? 0,
          decisionsReleaseAt: applicationSettings?.decisions_release_at ?? null,
          paidTickets: lifecycle?.paidTickets ?? 0,
        },
        now
      )}
      now={now.toISOString()}
    />
  );
}

/**
 * Ticket holders checked in to any agenda item, each counted once.
 * `statuses` is keyed `${ticketId}_${sessionId}` (`fetchCheckInStatuses`).
 */
function countCheckedIn(
  attendees: { id: string }[],
  statuses: Map<string, string | null>
): number {
  const holders = new Set(attendees.map((attendee) => attendee.id));
  const checkedIn = new Set<string>();
  for (const [key, checkedInAt] of statuses) {
    const ticketId = key.slice(0, key.indexOf("_"));
    if (checkedInAt && holders.has(ticketId)) checkedIn.add(ticketId);
  }
  return checkedIn.size;
}
