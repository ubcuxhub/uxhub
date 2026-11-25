import { PageContainer } from "@/components/shared/PageContainer";
import { Spinner } from "@/components/ui/spinner";

/** Overrides the event page's loading state (`../loading.tsx`) for the application. */
export default function Loading() {
  return (
    <PageContainer className="flex justify-center py-16">
      <Spinner size="lg" label="Loading application" />
    </PageContainer>
  );
}
