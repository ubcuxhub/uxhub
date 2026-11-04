import { PageContainer } from "@/components/shared/PageContainer";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { splitEventsByTime } from "@/features/events/lib/event-timeline";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";

export default async function PortalEvents() {
  if (!FLAGS.studentEvents) return <EventsComingSoon />;

  const supabase = await createClient();
  const events = await fetchEvents(supabase, { orderBy: "starts_at", status: "active" });

  const { upcomingEvents, pastEvents } = splitEventsByTime(events, new Date());

  return (
    <PageContainer>
      <h1 className="mb-6 text-h1 tracking-tight">Events</h1>

      <EventTimeline
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
      />
    </PageContainer>
  );
}
