"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { fetchRegistrationsForUser } from "@/lib/supabase-helpers/event-registrations";
import { EventCard, type EventRow } from "@/features/events";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CalendarDays, History, Radio } from "lucide-react";

function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="pt-2">
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

function EventGrid({
  events,
  onSelect,
}: {
  events: EventRow[];
  onSelect: (event: EventRow) => void;
}) {
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
            variant="default"
            onClick={() => onSelect(event)}
          />
        </div>
      ))}
    </div>
  );
}

export default function PortalEvents() {
  const { user } = useUser();
  const router = useRouter();

  const [ongoingEvents, setOngoingEvents] = useState<EventRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventRow[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadEvents(userId: string) {
      setLoading(true);
      try {
        const [events, registrations] = await Promise.all([
          fetchEvents(supabase, { orderBy: "start_date" }),
          fetchRegistrationsForUser(supabase, userId),
        ]);

        const registeredEventIds = new Set(
          registrations
            .filter((r) => r.status === "accepted")
            .map((r) => r.event_id),
        );

        const now = Date.now();
        const registered = events.filter((e) => registeredEventIds.has(e.id));

        const ongoing: EventRow[] = [];
        const upcoming: EventRow[] = [];
        const attended: EventRow[] = [];

        for (const e of registered) {
          const start = e.start_date ? new Date(e.start_date).getTime() : null;
          const end = e.end_date ? new Date(e.end_date).getTime() : null;

          if (start !== null && end !== null && start <= now && now <= end) {
            ongoing.push(e);
          } else if (start === null || start >= now) {
            upcoming.push(e);
          } else {
            attended.push(e);
          }
        }

        const startAsc = (a: EventRow, b: EventRow) =>
          new Date(a.start_date ?? 0).getTime() -
          new Date(b.start_date ?? 0).getTime();
        const startDesc = (a: EventRow, b: EventRow) =>
          new Date(b.start_date ?? 0).getTime() -
          new Date(a.start_date ?? 0).getTime();

        setOngoingEvents(ongoing.sort(startAsc));
        setUpcomingEvents(upcoming.sort(startAsc));
        setAttendedEvents(attended.sort(startDesc));
      } catch (error) {
        console.error("Error fetching events:", error);
        setOngoingEvents([]);
        setUpcomingEvents([]);
        setAttendedEvents([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) loadEvents(user.id);
  }, [user]);

  const openEvent = (event: EventRow) => router.push(`/events/${event.slug}`);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Your Events</h1>
        <p className="text-muted-foreground">
          View the events you&apos;re registered for.
        </p>
      </div>

      {/* Link to marketing events page */}
      <section className="mb-12">
        <Button asChild variant="outline">
          <Link href="/events">
            Browse all events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {loading ? (
        <section className="mb-12">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Ongoing Events */}
          {ongoingEvents.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Radio className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Ongoing Events</h2>
              </div>
              <EventGrid events={ongoingEvents} onSelect={openEvent} />
            </section>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Upcoming Events</h2>
              </div>
              <EventGrid events={upcomingEvents} onSelect={openEvent} />
            </section>
          )}
        </>
      )}

      {/* Attended Events */}
      {!loading && attendedEvents.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Attended Events</h2>
          </div>
          <EventGrid events={attendedEvents} onSelect={openEvent} />
        </section>
      )}
    </main>
  );
}
