import { PageContainer } from "@/components/shared/PageContainer";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { groupEventsByMonth, splitEventsByDate } from "@/features/events/lib/event-timeline";
import { getPacificStartDefaults } from "@/lib/date";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";

export default async function PortalEvents() {
  if (!FLAGS.studentEvents) return <EventsComingSoon />;

  const supabase = await createClient();
  const events = await fetchEvents(supabase, { orderBy: "start_date", status: "active" });

  const today = getPacificStartDefaults().start_date;
  const { upcomingEvents, pastEvents } = splitEventsByDate(events, today);

  const upcomingEventGroups = groupEventsByMonth(upcomingEvents);
  const pastEventGroups = groupEventsByMonth(pastEvents);

  return (
    <PageContainer>
      <h1 className="mb-3 text-h1 tracking-tight">Events</h1>

      <EventTimeline
        upcomingEventGroups={upcomingEventGroups}
        pastEventGroups={pastEventGroups}
      />
    </PageContainer>
  );
}
