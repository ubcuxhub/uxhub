import React from "react";
import Link from "next/link";
import EventCard from "@/features/marketing/components/EventCard";
import type { EventRow } from "@/types/models";

const EventsSection = ({ events }: { events: EventRow[] }) => {
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
        {events.length === 0 ? (
          <div className="text-center w-full py-20 border border-dashed border-gray-300 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-700">No events scheduled yet</h3>
          </div>
        ) : (
          events.map((event, index) => (
            <React.Fragment key={event.id}>
              <EventCard
                imageSrc={event.image_url || "/events/event1.png"}
                imageAlt={event.name || "Event Image"}
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
        <Link
          href="/events"
          className="group flex h-13 items-center justify-center gap-3 rounded-full border-2 border-black bg-black px-6 font-bold text-white transition-all duration-300 hover:bg-white hover:text-black"
        >
          SEE MORE EVENTS
        </Link>
      </div>
    </div>
  );
};

export default EventsSection;
