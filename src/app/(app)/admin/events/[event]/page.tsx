import { EventCreateModify } from "@/features/admin";
import React from "react";

interface EventViewProps {
  params: {
    event: string;
  };
}

const Page: React.FC<EventViewProps> = async ({ params }) => {
  const slug = await params;
  const eventId = slug.event;

  return (
    <div className="flex w-full justify-center py-10 gap-4">
      <EventCreateModify eventId={eventId} />
    </div>
  );
};

export default Page;
