"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminSidebar } from "@/components/AdminSidebar";
import { createClient } from "@/lib/supabase/client";
import type { Event } from "@/lib/types/eventTypes";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EventCard } from "@/components/EventCard";

const AdminEventsManager = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      console.log(data);

      if (error) {
        setError(error.message);
      } else {
        setEvents((data ?? []) as Event[]);
      }

      setIsLoading(false);
    };

    fetchEvents();
  }, []);

  return (
    <ProtectedRoute admin>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-8 px-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Events Dashboard</h1>
                <p className="text-sm text-muted-foreground">
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
                  <EventCard key={event.id} event={event} variant="admin" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminEventsManager;
