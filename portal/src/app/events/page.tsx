"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Event } from "@/lib/types/eventTypes";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Events() {
  const { user } = useUser();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      setLoadingEvents(true);
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });
      setEvents(data ?? []);
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
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventWithId = event as Event & { id: string };
            return (
              <div
                key={eventWithId.id}
                className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/events/${eventWithId.id}`)}
              >
                <h3 className="font-semibold text-lg">{event.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {event.event_date} at {event.event_time}
                </p>
                {event.description && (
                  <p className="text-sm mt-2 line-clamp-2">{event.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button onClick={() => router.push("/profile")}>View profile</Button>
      <LogoutButton />
    </ProtectedRoute>
  );
}
