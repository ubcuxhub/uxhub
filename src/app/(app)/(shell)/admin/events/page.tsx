import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  AdminEventsTable,
  type AdminEventTableRow,
} from "@/features/admin/components/AdminEventsTable";
import { registrationWindow } from "@/features/admin/lib/event-registration-window";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";

/*
 * A plain link on purpose: a soft navigation to `/admin/events/create-new`
 * matches the record drawer's intercepted `[event]` route
 * (`@flow/(.)admin/events/[event]`) before the static page, so it would open a
 * drawer over this list instead of the builder. A document load is never
 * intercepted.
 */
const CREATE_EVENT_HREF = "/admin/events/create-new";

export default async function AdminEventsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const events = await fetchEvents(supabase, {
    orderBy: "created_at",
    ascending: false,
  });
  // One aggregate call rather than a head-count per event: the per-event form
  // meant a thirty-event dashboard opened thirty concurrent PostgREST requests.
  const seatCounts = await fetchEventSeatCounts(
    supabase,
    events.map((event) => event.id)
  );

  const now = new Date();
  const rows: AdminEventTableRow[] = events.map((event) => ({
    event,
    registrationCount: seatCounts.get(event.id)?.tickets ?? 0,
    registrationOpen: registrationWindow(event, now) === "open",
  }));

  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-h1 tracking-tight">
            Events Dashboard
          </h1>
          <p className="text-muted-foreground">
            Review, create, and manage upcoming events.
          </p>
        </div>
        <Button asChild>
          <a href={CREATE_EVENT_HREF}>Create Event</a>
        </Button>
      </header>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="text-2xl font-semibold">No events yet</div>
          <p className="max-w-md text-sm text-muted-foreground">
            You haven&apos;t created any events. Use the create button to add
            your first event and it will show up here.
          </p>
          <Button asChild variant="outline">
            <a href={CREATE_EVENT_HREF}>Create your first event</a>
          </Button>
        </div>
      ) : (
        <AdminEventsTable rows={rows} />
      )}
    </PageContainer>
  );
}
