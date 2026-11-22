import { notFound } from "next/navigation";

import { EventOverview } from "@/features/admin/components/event-manager/EventOverview";
import { eventNeedsAction } from "@/features/admin/lib/event-needs-action";
import { countCheckedInTickets } from "@/features/admin/lib/event-registrations";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchCheckInAttendees, fetchCheckInStatuses } from "@/lib/supabase-helpers/check-ins";
import { fetchEventApplicationSettings } from "@/lib/supabase-helpers/event-application-settings";
import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { fetchEventLifecycleCounts } from "@/lib/supabase-helpers/event-lifecycle";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";

/**
 * The event manager's Overview tab (`/admin/events/<id>/overview`): what
 * needs action, who registered, the registration numbers (with the
 * applications by status, for an event that takes them), and the event's
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

  const [applications, applicationSettings, lifecycle] = await Promise.all([
    event.requires_application ? fetchEventApplicationStatusCounts(supabase, eventId) : null,
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
      checkedIn={countCheckedInTickets(
        checkIns,
        attendees.map((attendee) => attendee.id)
      )}
      applications={applications}
      registrations={attendees.map((attendee) => ({ id: attendee.id, name: attendee.user_name }))}
      needsAction={eventNeedsAction(
        {
          event,
          applicationsToReview: applications?.submitted ?? 0,
          decisionsReleaseAt: applicationSettings?.decisions_release_at ?? null,
          paidTickets: lifecycle?.paidTickets ?? 0,
        },
        now
      )}
      now={now.toISOString()}
    />
  );
}
