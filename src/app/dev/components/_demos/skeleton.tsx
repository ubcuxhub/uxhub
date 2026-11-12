import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

/** Skeleton rows shaped like the table rows above (§3.6: skeleton rows, never a spinner). */
function SkeletonRows() {
  return (
    <Card className="w-full gap-0 py-0">
      <ul className="divide-y divide-border-subtle" aria-busy="true" aria-label="Loading attendees">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex h-(--size-table-row) items-center gap-3 px-6">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="hidden h-3.5 w-16 sm:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-3.5 w-12 sm:block" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SkeletonDemo() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="Skeleton"
        spec="§3.6"
        description="Shapes stay with callers; the primitive is a pulsing, aria-hidden block."
      >
        <Specimen label="text lines" className="w-64">
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Specimen>
        <Specimen label="avatar + lines" className="w-64">
          <div className="flex w-full items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </Specimen>
        <Specimen label="card" className="w-64">
          <Skeleton className="h-24 w-full rounded-xl" />
        </Specimen>
        <Specimen label="table rows (same row height and columns as the table in a card on the Card page)" wide>
          <SkeletonRows />
        </Specimen>
      </SpecimenGroup>
    </div>
  );
}

export default SkeletonDemo;
