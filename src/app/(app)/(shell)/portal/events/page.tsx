import { PageContainer } from "@/components/shared/PageContainer";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import { EventsComingSoon } from "@/features/events/components/EventsComingSoon";
import { groupEventsByMonth, splitEventsByDate } from "@/features/events/lib/event-timeline";
import { FLAGS } from "@/lib/flags";
import { getPacificStartDefaults } from "@/lib/date";
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

      {/* Search Bar */}
      {/* TODO: make sure events.length updates on search & make sure Display N events shows right value*/}
      {/* <p className="pb-4 text-muted-foreground">Displaying {events.length} events</p> */}
      {/* <p className="my-6">( search bar here )</p> */}

      {/* Events List */}
      <EventTimeline
        upcomingEventGroups={upcomingEventGroups}
        pastEventGroups={pastEventGroups}
      />
    </PageContainer>
  );
}
