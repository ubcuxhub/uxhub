import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { fetchRegistrationsForUser } from "@/lib/supabase-helpers/event-registrations";
import { EventCard } from "@/components/shared/EventCard";
import type { EventRow } from "@/types/models";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { ArrowRight, CalendarDays, History, Radio } from "lucide-react";

function EventGrid({ events }: { events: EventRow[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((event, index) => (
        <div
          key={event.id}
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{
            animationDelay: `${index * 75}ms`,
            animationFillMode: "backwards",
          }}
        >
          <EventCard
            event={event}
            href={`/portal/events/${event.slug}`}
          />
        </div>
      ))}
    </div>
  );
}

export default async function PortalEvents() {
  const user = await requireAuth();
  const supabase = await createClient();
  const [events, registrations] = await Promise.all([
    fetchEvents(supabase, { orderBy: "start_date" }),
    fetchRegistrationsForUser(supabase, user.id),
  ]);
  const registeredEventIds = new Set(
    registrations
      .filter((registration) => registration.status === "accepted")
      .map((registration) => registration.event_id)
  );
  // Server-rendered categorization needs the request's current wall-clock time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const ongoingEvents: EventRow[] = [];
  const upcomingEvents: EventRow[] = [];
  const attendedEvents: EventRow[] = [];

  for (const event of events.filter((item) => registeredEventIds.has(item.id))) {
    const start = event.start_date ? new Date(event.start_date).getTime() : null;
    const end = event.end_date ? new Date(event.end_date).getTime() : null;
    if (start !== null && end !== null && start <= now && now <= end) {
      ongoingEvents.push(event);
    } else if (start === null || start >= now) {
      upcomingEvents.push(event);
    } else {
      attendedEvents.push(event);
    }
  }

  const startTime = (event: EventRow) =>
    new Date(event.start_date ?? 0).getTime();
  ongoingEvents.sort((a, b) => startTime(a) - startTime(b));
  upcomingEvents.sort((a, b) => startTime(a) - startTime(b));
  attendedEvents.sort((a, b) => startTime(b) - startTime(a));

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">Your Events</h1>
        <p className="text-muted-foreground">
          View the events you&apos;re registered for.
        </p>
      </div>
      <section className="mb-12">
        <Button asChild variant="outline">
          <Link href="/events">
            Browse all events
            <ArrowRight />
          </Link>
        </Button>
      </section>
      {ongoingEvents.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <Radio className="text-muted-foreground" />
            <h2 className="text-xl font-semibold">Ongoing Events</h2>
          </div>
          <EventGrid events={ongoingEvents} />
        </section>
      )}
      {upcomingEvents.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <CalendarDays className="text-muted-foreground" />
            <h2 className="text-h3">Upcoming Events</h2>
          </div>
          <EventGrid events={upcomingEvents} />
        </section>
      )}
      {attendedEvents.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <History className="text-muted-foreground" />
            <h2 className="text-h3">Attended Events</h2>
          </div>
          <EventGrid events={attendedEvents} />
        </section>
      )}
    </PageContainer>
  );
}
