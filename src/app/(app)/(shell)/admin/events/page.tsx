"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EventCard, type EventRow } from "@/features/events";
import { createClient } from "@/lib/supabase/client";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PageContainer } from "@/components/shared/PageContainer";

const AdminEventsManager = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchEvents(supabase, {
          orderBy: "created_at",
          ascending: false,
        });
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, []);

  return (
    <PageContainer className="flex flex-col gap-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  Events Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Review, create, and manage upcoming events.
                </p>
              </div>
              <Button asChild>
                <Link href="/admin/events/create-new">Create Event</Link>
              </Button>
            </header>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 p-10 text-center text-sm text-destructive">
                {error}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
                <div className="text-2xl font-semibold">No events yet</div>
                <p className="max-w-md text-sm text-muted-foreground">
                  You haven&apos;t created any events. Use the create button to
                  add your first event and it will show up here.
                </p>
                <Button asChild variant="outline">
                  <Link href="/admin/events/create-new">
                    Create your first event
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    variant="admin"
                    adminLinks={{
                      editHref: `/admin/events/${event.id}`,
                      checkInHref: `/admin/events/${event.id}/check-in`,
                      applicationsHref: `/admin/events/${event.id}/review-applications`,
                    }}
                  />
                ))}
              </div>
            )}
    </PageContainer>
  );
};

export default AdminEventsManager;
