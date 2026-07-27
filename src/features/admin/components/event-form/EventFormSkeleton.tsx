import { Skeleton } from "@/components/ui/skeleton";

export function EventFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[2, 2, 4, 3, 2].map((fields, section) => (
        <section
          key={section}
          className="grid gap-4 md:grid-cols-2"
          aria-hidden="true"
        >
          {Array.from({ length: fields }, (_, field) => (
            <div key={field} className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </section>
      ))}
      {[0, 1].map((section) => (
        <section key={section} className="grid gap-4" aria-hidden="true">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-32 w-full" />
        </section>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
