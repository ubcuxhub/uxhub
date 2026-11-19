import { BackButton } from "@/components/shared/BackButton";
import { PageContainer } from "@/components/shared/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { EventFormSkeleton } from "@/features/admin/components/event-form/EventFormSkeleton";

export default function LoadingEventBuilder() {
  return <PageContainer className="max-w-none space-y-6 min-[821px]:px-12 lg:px-12">
    <BackButton link="/admin/events" label="Back to Manage Events" className="h-8 w-fit px-4 text-small" />
    <div role="status" aria-busy="true" aria-label="Loading event" className="space-y-8 motion-reduce:[&_[data-slot=skeleton]]:animate-none"><div className="flex flex-wrap items-center gap-3" aria-hidden><Skeleton className="h-9 w-80 max-w-full" /><Skeleton className="h-6 w-16" /></div><EventFormSkeleton /></div>
  </PageContainer>;
}
