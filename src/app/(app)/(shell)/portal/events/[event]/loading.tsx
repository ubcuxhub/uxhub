import { PageContainer } from "@/components/shared/PageContainer";
import { EventPageSkeleton } from "@/features/events/components/EventPageSkeleton";

/** The event page's back pill is live while the rest of the page loads. */
export default function Loading() {
  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events">
      <EventPageSkeleton />
    </PageContainer>
  );
}
