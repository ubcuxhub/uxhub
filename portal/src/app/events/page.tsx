"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Event } from "@/lib/types/eventTypes";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import ProtectedRoute from "@/components/ProtectedRoute";
import { EventCard } from "@/components/EventCard";

export default function Events() {
  const { user } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
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
        setEvents((data ?? []) as Event[]);
      }
      setLoadingEvents(false);
    }

    if (user) fetchEvents();
  }, [user]);

  return (
    <ProtectedRoute>
      <p>Hi!</p>
      <p>{`Logged in as ${user?.email}`}</p>

      <p>Events:</p>

      {loadingEvents ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No events available.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              variant="default"
              onClick={() => router.push(`/events/${event.id}`)}
            />
          ))}
        </div>
      )}
      <Button onClick={() => router.push("/profile")}>View profile</Button>
      <LogoutButton />
    </ProtectedRoute>
  );
}
