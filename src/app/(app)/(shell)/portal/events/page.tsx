import { PageContainer } from "@/components/shared/PageContainer";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { splitEventsByTime } from "@/features/events/lib/event-timeline";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";

export default async function PortalEvents() {
  if (!FLAGS.studentEvents) return <EventsComingSoon />;

  const user = await requireAuth();
  const supabase = await createClient();
  const events = await fetchEvents(supabase, { orderBy: "starts_at", status: "active" });

  const now = new Date();
  const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
  const states = await loadEventStates(supabase, user.id, events, now);
  const badges = Object.fromEntries(
    Object.entries(states).map(([id, state]) => [id, eventBadgeFor(state)])
  );

  return (
    <PageContainer>
      <h1 className="mb-6 text-h1 tracking-tight">Events</h1>

      <EventTimeline
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        badges={badges}
      />
    </PageContainer>
  );
}
