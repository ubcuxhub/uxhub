import { RecordNotFound } from "@/components/shared/RecordDrawer";
import { AdminEventRecord } from "@/features/admin/components/AdminEventRecord";
import { findAdminEvent } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";

/**
 * An event's admin overview, for `/admin/events/<slug>`: the content of
 * the drawer the events layout opens over the list. Guards, resolves the param
 * (an event ID redirects to the slug), fetches, and hands the client
 * `AdminEventRecord` everything it shows.
 *
 * Guards before any query, although the admin layout already has: layouts
 * and pages render in parallel, so the layout's guard doesn't stop this
 * page's queries from starting.
 */
export async function AdminEventRecordRoute({ eventParam }: { eventParam: string }) {
  await requireAdmin();

  const supabase = await createClient();
  const event = await findAdminEvent(supabase, eventParam);
  if (!event) return <RecordNotFound noun="event" />;
  const eventId = event.id;

  const [seatCounts, applications] = await Promise.all([
    fetchEventSeatCounts(supabase, [eventId]),
    fetchEventApplicationStatusCounts(supabase, eventId),
  ]);

  const seats = seatCounts.get(eventId);

  return (
    <AdminEventRecord
      event={event}
      seats={{
        tickets: seats?.tickets ?? 0,
        seatsLeft: seats?.seatsLeft ?? event.max_capacity ?? 0,
      }}
      applications={applications}
      now={new Date().toISOString()}
      publicPages={FLAGS.studentEvents}
    />
  );
}
