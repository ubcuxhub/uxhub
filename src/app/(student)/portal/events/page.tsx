"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/features/auth";
import { EventCard, type EventRow } from "@/features/events";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, User } from "lucide-react";

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No events yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        There are no upcoming events at the moment. Check back soon for exciting
        new events!
      </p>
    </div>
  );
}

export default function Events() {
  const { user } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        setEvents([]);
      } else {
        setEvents(data ?? []);
      }
      setLoadingEvents(false);
    }

    if (user) fetchEvents();
  }, [user]);

  // Get first name from email or user name
  const firstName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-lg">UBC UX Hub</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/portal/profile")}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto max-w-6xl px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Hey, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground">
              Explore upcoming events and find something that interests you.
            </p>
          </div>

          {/* Events Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Upcoming Events</h2>
              {!loadingEvents && events.length > 0 && (
                <span className="text-sm text-muted-foreground ml-1">
                  ({events.length})
                </span>
              )}
            </div>

            {loadingEvents ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            ) : events.length === 0 ? (
              <EmptyState />
            ) : (
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
                      onClick={() =>
                        router.push(`/portal/events/${event.slug}/checkout`)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t mt-auto">
          <div className="container mx-auto max-w-6xl px-4 py-6">
            <p className="text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} UX Hub. All rights reserved.
            </p>
          </div>
        </footer>
    </div>
  );
}
