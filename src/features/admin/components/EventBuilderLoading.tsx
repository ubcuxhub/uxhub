import { PageContainer } from "@/components/shared/PageContainer";
import { Spinner } from "@/components/ui/spinner";
import { EventBuilderRouteBackPill } from "./EventBuilderBackPill";

export default function LoadingEventBuilder() {
  return <PageContainer className="max-w-none space-y-6 min-[821px]:px-12 lg:px-12">
    <EventBuilderRouteBackPill className="h-8 px-4 text-small" />
    <div className="flex justify-center py-16"><Spinner size="lg" label="Loading event" /></div>
  </PageContainer>;
}
