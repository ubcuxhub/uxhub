import { PageContainer } from "@/components/shared/PageContainer";
import { Alert } from "@/components/ui/alert";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { timelineBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { splitEventsByTime } from "@/features/events/lib/event-timeline";
import {
  DRAFT_EVENTS_NOTE,
  portalEventStatuses,
  showsDraftEventsNote,
} from "@/features/events/lib/event-visibility";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { pacificDate } from "@/lib/date";

export default async function PortalEvents() {
  if (!FLAGS.studentEvents) return <EventsComingSoon />;

  const user = await requireAuth();
  const supabase = await createClient();
  // Members see published events; admins and managers also see drafts, to
  // preview them. RLS enforces the same rule, so the filter only narrows it.
  const events = await fetchEvents(supabase, {
    orderBy: "starts_at",
    statuses: portalEventStatuses(user.role_access),
  });

  const now = new Date();
  const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
  const states = await loadEventStates(supabase, user.id, events, now);
  const badges = Object.fromEntries(
    events.map((event) => [event.id, timelineBadgeFor(event, states[event.id])])
  );

  return (
    <PageContainer>
      <h1 className="mb-6 text-h1 tracking-tight">Events</h1>

      {/* Only the listed events count: the timeline leaves out undated drafts. */}
      {showsDraftEventsNote(user.role_access, [...upcomingEvents, ...pastEvents]) && (
        <Alert variant="neutral" className="mb-6">
          {DRAFT_EVENTS_NOTE}
        </Alert>
      )}

      <EventTimeline
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        badges={badges}
        currentMonth={pacificDate(now.toISOString()).slice(0, 7)}
      />
    </PageContainer>
  );
}
