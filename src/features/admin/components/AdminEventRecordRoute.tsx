import { RecordNotFound } from "@/components/shared/RecordDrawer";
import { AdminEventRecord } from "@/features/admin/components/AdminEventRecord";
import { findAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";

/**
 * An event's admin overview, for `/admin/events/<id>`: the content of the
 * drawer the events layout opens over the list. Guards, resolves the param (a
 * slug redirects to the ID), fetches, and hands the client `AdminEventRecord`
 * everything it shows.
 *
 * Guards before any query, although the admin layout already has: layouts
 * and pages render in parallel, so the layout's guard doesn't stop this
 * page's queries from starting.
 */
export async function AdminEventRecordRoute({ eventParam }: { eventParam: string }) {
  await requireAdmin();

  const supabase = await createClient();
  const eventId = await findAdminEventId(supabase, eventParam);
  if (!eventId) return <RecordNotFound noun="event" />;

  const [event, seatCounts, applications] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchEventSeatCounts(supabase, [eventId]),
    fetchEventApplicationStatusCounts(supabase, eventId),
  ]);
  if (!event) return <RecordNotFound noun="event" />;

  const seats = seatCounts.get(eventId);

  return (
    <AdminEventRecord
      event={event}
      seats={{
        tickets: seats?.tickets ?? 0,
        seatsLeft: seats?.seatsLeft ?? event.max_capacity,
      }}
      applications={applications}
      now={new Date().toISOString()}
      publicPages={FLAGS.studentEvents}
    />
  );
}
