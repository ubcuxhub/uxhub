import { PageContainer } from "@/components/shared/PageContainer";
import { Spinner } from "@/components/ui/spinner";

export default function TeamsLoading() {
  return (
    <PageContainer className="flex justify-center py-16">
      <Spinner size="lg" label="Loading teams" />
    </PageContainer>
  );
}
