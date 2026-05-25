import React from "react";
import Button from "@/features/marketing/components/Button";
import EventCard from "@/features/marketing/components/EventCard";
import { EVENTS } from "@/features/marketing/lib/events";
import type { Event as SiteEvent } from "@/features/marketing/types";

const EventsSection: React.FC = () => {
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

  const iconByType: Record<SiteEvent["icon"], React.ReactNode> = {
    triangle: triangleIcon,
    star: starIcon,
  };

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

      {/* event cards */}
      <div className="flex flex-col md:flex-row">
        {EVENTS.map((event, index) => (
          <React.Fragment key={event.imageSrc}>
            <EventCard
              imageSrc={event.imageSrc}
              imageAlt={event.imageAlt}
              buttonText={event.buttonText}
              buttonIcon={iconByType[event.icon]}
            />
            {index < EVENTS.length - 1 && (
              <div className="md:w-[5%] h-8" aria-hidden="true"></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center flex justify-center pt-16">
        <Button
          variant="primary"
          onClick={() => (window.location.href = "/under-construction")}
        >
          SEE MORE EVENTS
        </Button>
      </div>
    </div>
  );
};

export default EventsSection;
