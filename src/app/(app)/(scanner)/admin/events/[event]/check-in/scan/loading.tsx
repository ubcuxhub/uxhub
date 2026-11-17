import { PageContainer } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
export default function CheckInLoading() {
  return <PageContainer backHref="/admin/events" backLabel="Back to Manage Events" className="flex flex-col gap-6"><div aria-busy="true" aria-label="Loading check-in" className="flex flex-col gap-6"><Skeleton className="h-8 w-48"/><Skeleton className="h-11 w-full"/><div className="grid grid-cols-2 gap-3"><StatCard label="Checked in" kind="loading"/><StatCard label="Not checked in" kind="loading"/></div>{[0,1,2].map(i=><Skeleton key={i} className="h-16 w-full"/>)}</div></PageContainer>;
}
