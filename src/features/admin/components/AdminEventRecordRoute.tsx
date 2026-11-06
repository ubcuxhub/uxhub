import { notFound } from "next/navigation";

import { RecordNotFound } from "@/components/shared/RecordDrawer";
import { AdminEventRecord } from "@/features/admin/components/AdminEventRecord";
import { LoadAsDocument } from "@/features/admin/components/LoadAsDocument";
import {
  findAdminEventId,
  resolveAdminEventId,
} from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";

/**
 * Pages beside `[event]` under `/admin/events`. A soft navigation to one is
 * caught by the drawer's intercepted `[event]` route before the page itself
 * (Next applies interception rewrites ahead of the file system), so the
 * drawer hands it on as a document load.
 */
const SIBLING_PAGES = new Set(["create-new"]);

/**
 * An event's admin overview: the server half of the record drawer and of the
 * page at `/admin/events/<id>`. Guards, resolves the param, fetches, and hands
 * the client `AdminEventRecord` everything it shows.
 *
 * `@flow` renders outside the `(app)` and admin layouts, so this guards
 * itself before any query.
 */
export async function AdminEventRecordRoute({
  eventParam,
  mode,
}: {
  eventParam: string;
  mode: "intercepted" | "canonical";
}) {
  await requireAdmin();

  if (mode === "intercepted" && SIBLING_PAGES.has(eventParam)) {
    return <LoadAsDocument href={`/admin/events/${eventParam}`} />;
  }

  const supabase = await createClient();
  const eventId =
    mode === "canonical"
      ? await resolveAdminEventId(supabase, eventParam)
      : await findAdminEventId(supabase, eventParam);
  if (!eventId) return <RecordNotFound noun="event" />;

  const [event, seatCounts, applications] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchEventSeatCounts(supabase, [eventId]),
    fetchEventApplicationStatusCounts(supabase, eventId),
  ]);
  if (!event) return mode === "canonical" ? notFound() : <RecordNotFound noun="event" />;

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
