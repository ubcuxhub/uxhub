import { Skeleton } from "@/components/ui/skeleton";

export function EventFormSkeleton() {
  return <div className="flex flex-col gap-14" aria-hidden>
    {[0, 1, 2].map(section => <section key={section} className="space-y-4">
      <Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-48" />
      <div className="space-y-4 rounded-xl border border-border p-5">
        <Skeleton className="h-4 w-30" /><Skeleton className="h-10 w-full" />
        {section === 0 ? <div className="flex flex-wrap gap-6"><Skeleton className="size-40" /><Skeleton className="h-40 min-w-0 flex-1" /></div> : <Skeleton className="h-32 w-full" />}
      </div>
    </section>)}
  </div>;
}
