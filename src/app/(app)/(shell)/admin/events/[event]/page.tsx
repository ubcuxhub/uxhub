import { EventCreateModify } from "@/features/admin";
import { PageContainer } from "@/components/shared/PageContainer";
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
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify eventId={eventId} />
    </PageContainer>
  );
};

export default Page;
