import { PageContainer } from "@/components/shared/PageContainer";
import { UpcomingEventPanel } from "@/features/admin";
import { createClient } from "@/lib/supabase/server";
import { countRegistrationsForEvent } from "@/lib/supabase-helpers/event-registrations";
import { fetchUpcomingEvent } from "@/lib/supabase-helpers/events";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const upcomingEvent = await fetchUpcomingEvent(supabase);
  const upcomingEventRsvpCount = upcomingEvent
    ? await countRegistrationsForEvent(supabase, upcomingEvent.id, ["accepted"])
    : 0;

  return (
    <PageContainer className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          View events, users, and statistics at a glance.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingEventPanel
          event={upcomingEvent}
          rsvpCount={upcomingEventRsvpCount}
        />
      </div>
    </PageContainer>
  );
}
