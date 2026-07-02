"use client";

import React, { useEffect, useState } from "react";
import Button from "@/features/marketing/components/Button";
import EventCard from "@/features/marketing/components/EventCard";
import { createClient } from "@/lib/supabase/client";
import type { EventRow } from "@/types/models";

const EventsSection: React.FC = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function fetchEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true })
        .limit(2);
      if (!error && data) setEvents(data);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const triangleIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M3 21L12 3L21 21H3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const starIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path d="M6 9H12.5L11 10.5L12.5 12H6V9Z" fill="currentColor" />
      <path
        d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div id="events" className="px-[5%] md:px-[20%]">
      <div className="mb-8">
        <p className="mb-0 text-gray font-serif italic font-semibold text-[32px]">
          events
        </p>
        <h2 className=" text-[40px] font-bold leading-tight">
          Learn by doing, connect by creating
        </h2>
      </div>


      <div className="flex flex-col md:flex-row">
        {loading ? (
          <div className="flex w-full justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center w-full py-20 border border-dashed border-gray-300 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-700">No events scheduled yet</h3>
          </div>
        ) : (
          events.map((event, index) => (
            <React.Fragment key={event.id}>
              <EventCard
                imageSrc={event.image_url || "/events/event1.png"}
                imageAlt={event.name || "Event Image"}
                buttonText={index % 2 === 0 ? "office tour" : "competition"}
                buttonIcon={index % 2 === 0 ? triangleIcon : starIcon}
                href={`/events/${event.slug || event.id}`}
              />
              {index < events.length - 1 && (
                <div className="md:w-[5%] h-8" aria-hidden="true"></div>
              )}
            </React.Fragment>
          ))
        )}
      </div>


      <div className="text-center flex justify-center pt-16">
        <Button
          variant="primary"
          onClick={() => (window.location.href = "/events")}
        >
          SEE MORE EVENTS
        </Button>
      </div>
    </div>
  );
};

export default EventsSection;
