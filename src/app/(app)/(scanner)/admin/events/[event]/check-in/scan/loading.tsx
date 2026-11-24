import { PageContainer } from "@/components/shared/PageContainer";
import { Spinner } from "@/components/ui/spinner";

export default function CheckInLoading() {
  return (
    <PageContainer backHref="/admin/events" backLabel="Back to Manage Events">
      <div className="flex justify-center py-16">
        <Spinner size="lg" label="Loading check-in" />
      </div>
    </PageContainer>
  );
}
