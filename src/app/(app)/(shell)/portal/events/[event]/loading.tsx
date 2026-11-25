import { PageContainer } from "@/components/shared/PageContainer";
import { Spinner } from "@/components/ui/spinner";

/** The event page's back pill is live while the rest of the page loads. */
export default function Loading() {
  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events">
      <div className="flex justify-center py-16">
        <Spinner size="lg" label="Loading event" />
      </div>
    </PageContainer>
  );
}
