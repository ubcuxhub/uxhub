import { PageContainer } from "@/components/shared/PageContainer";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { loadEventBadges } from "@/features/events/lib/event-badge";
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
  const badges = await loadEventBadges(supabase, user.id, events, now);

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
