"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { type EventRow } from "@/features/events";
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

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

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
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Date</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Price</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="font-medium hover:underline"
                          >
                            {event.name}
                          </Link>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 sm:hidden">
                            {formatDate(event.start_date)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {formatDate(event.start_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          ${Number(event.regular_price ?? 0).toFixed(2)}
                          {event.member_price !== event.regular_price && (
                            <span className="ml-1 text-xs">
                              / ${Number(event.member_price ?? 0).toFixed(2)} member
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="outline" size="default">
                              <Link href={`/admin/events/${event.id}`}>Edit</Link>
                            </Button>
                            <Button asChild variant="outline" size="default">
                              <Link href={`/admin/events/${event.id}/check-in`}>Check-In</Link>
                            </Button>
                            <Button asChild variant="outline" size="default">
                              <Link href={`/admin/events/${event.id}/review-applications`}>Apps</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </PageContainer>
  );
};

export default AdminEventsManager;
