import React from "react";
import EventCard from "../components/EventCard";
import Button from "@/components/Button";

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
        <EventCard
          imageSrc="/events/event1.png"
          imageAlt="Design Archetypes Event"
          buttonText="office tour"
          buttonIcon={triangleIcon}
        />

        <div className="md:w-[5%] h-8"></div>

        <EventCard
          imageSrc="/events/event2.png"
          imageAlt="UXATHON 2025 Event"
          buttonText="competition"
          buttonIcon={starIcon}
        />
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
