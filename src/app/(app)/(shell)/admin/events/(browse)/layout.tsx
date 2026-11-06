import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableCard } from "@/components/ui/table";
import { PageContainer } from "@/components/shared/PageContainer";
import { RecordFrame, RecordList } from "@/components/shared/RecordDrawer";
import {
  AdminEventsTable,
  type AdminEventTableRow,
} from "@/features/admin/components/AdminEventsTable";
import { registrationWindow } from "@/features/admin/lib/event-registration-window";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";

const CREATE_EVENT_HREF = "/admin/events/create-new";

/**
 * Manage events. A layout, so the list stays mounted while an event's
 * overview (`[event]/page.tsx`) opens in a drawer over it and while events are
 * swapped; a refresh of an event's URL shows the list with its drawer too.
 *
 * In the `(browse)` group so it wraps the overview but not the pages beside
 * it (`[event]/edit`, `check-in`, `review-applications`, `create-new`), which
 * are full pages. An event's builder is its full page: `RecordList` fades the
 * list out as the drawer grows into it, and back in as it collapses.
 */
export default async function AdminEventsLayout({ children }: { children: React.ReactNode }) {
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
    <RecordList>
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
            <Link href={CREATE_EVENT_HREF}>Create Event</Link>
          </Button>
        </header>

        {events.length === 0 ? (
          <TableCard>
            <EmptyState
              size="page"
              icon={<CalendarPlus aria-hidden />}
              title="No events yet"
              description="Events you create show up here."
              actions={
                <Button asChild variant="secondary" size="sm">
                  <Link href={CREATE_EVENT_HREF}>Create your first event</Link>
                </Button>
              }
            />
          </TableCard>
        ) : (
          <AdminEventsTable rows={rows} />
        )}
        <RecordFrame listHref="/admin/events">{children}</RecordFrame>
      </PageContainer>
    </RecordList>
  );
}
