"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";
import type { Event } from "@/lib/types/eventTypes";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type EventRecord = Event & { id: string };

interface AdminSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchEvents = async () => {
      try {
        setIsLoadingEvents(true);
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .order("start_date", { ascending: true });

        if (error) throw error;
        setEvents((data ?? []) as EventRecord[]);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    // Fetch on mount
    fetchEvents();

    // Set up realtime subscription
    const channel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "events",
        },
        () => {
          // Refetch events when any change occurs
          fetchEvents();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <aside
      className={cn(
        "w-64 border-r bg-muted/40 p-6 flex flex-col gap-6",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold mb-2">Events</h2>
        <div className="w-full flex items-center justify-between">
          <Link
            href="/admin/events"
            className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All Events
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              setEventsOpen(!eventsOpen);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Toggle events dropdown"
          >
            <FontAwesomeIcon
              icon={faChevronLeft}
              className={cn(
                "transition-transform text-xs",
                eventsOpen && "-rotate-90"
              )}
            />
          </button>
        </div>
        {eventsOpen && (
          <div className="mt-2 ml-4 space-y-1">
            {isLoadingEvents && events.length === 0 ? (
              <div className="flex items-center justify-center py-2">
                <Spinner size="sm" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-xs text-muted-foreground">No events</div>
            ) : (
              events.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {event.name}
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Users</h2>
        <Link
          href="/admin/users"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage Users
        </Link>
      </div>
    </aside>
  );
}
