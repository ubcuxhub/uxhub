import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Agenda row widths (column 2), so the rows don't read as one stamped block. */
const AGENDA_ROW_WIDTHS = ["w-[55%]", "w-[70%]", "w-[45%]", "w-[60%]", "w-1/2"];

/** One of the three date / location / link items under the event title. */
function InfoItemSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-3.5 w-3/5 rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
      </div>
    </div>
  );
}

/** A section card's title strip (registration, agenda). */
function SectionHeaderSkeleton({ width }: { width: string }) {
  return (
    <div className="border-b border-border-subtle px-5 pt-5 pb-4">
      <Skeleton className={`h-4.5 rounded-full ${width}`} />
    </div>
  );
}

/**
 * The portal event page while it loads (Figma 1.18, "Event page loading"):
 * the hero card, the registration card and the agenda table, as shaped
 * `surface-subtle` blocks. The back pill is rendered for real by the caller.
 */
export function EventPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span role="status" className="sr-only">
        Loading event
      </span>

      {/* Hero: header image, thumbnail, title, status badge, info, description. */}
      <Card className="gap-0 overflow-hidden py-0">
        <Skeleton className="h-40 w-full rounded-none" />
        <div className="px-5 pb-8 sm:px-8">
          <div className="relative -mt-12 size-24 rounded-xl border-4 border-card bg-card">
            <Skeleton className="size-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-3 pt-5">
            <Skeleton className="h-7 w-80 max-w-full rounded-lg" />
            <Skeleton className="h-6 w-35 rounded-full" />
          </div>
          <div className="mt-6 grid gap-6 border-t border-border-subtle pt-6 sm:grid-cols-3">
            <InfoItemSkeleton />
            <InfoItemSkeleton />
            <InfoItemSkeleton />
          </div>
          <div className="flex max-w-180 flex-col gap-2.5 pt-6">
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-[85%] rounded-full" />
          </div>
        </div>
      </Card>

      {/* Registration: summary and two actions beside the ticket. */}
      <Card className="gap-0 overflow-hidden rounded-2xl py-0">
        <SectionHeaderSkeleton width="w-30" />
        <div className="grid items-center gap-8 p-5 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4.5 w-[70%] rounded-full" />
            <Skeleton className="h-3 w-[90%] rounded-full" />
            <div className="h-2" />
            <Skeleton className="h-10 w-full rounded-full" />
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
          <Skeleton className="h-42 w-full rounded-2xl" />
        </div>
      </Card>

      {/* Agenda: a table with a header row and five entries. */}
      <Card className="gap-0 overflow-hidden rounded-2xl py-0">
        <SectionHeaderSkeleton width="w-25" />
        <div className="p-5">
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <div className="bg-section px-4 py-3.5">
              <Skeleton className="h-3 w-45 max-w-full rounded-full" />
            </div>
            {AGENDA_ROW_WIDTHS.map((width, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-center gap-4 border-t border-border-subtle p-4 md:grid-cols-[180px_minmax(0,1fr)_160px_96px]"
              >
                <Skeleton className="h-3 w-[70%] rounded-full" />
                <Skeleton className={`h-3 rounded-full ${width}`} />
                <Skeleton className="hidden h-3 w-4/5 rounded-full md:block" />
                <Skeleton className="hidden h-3 w-3/5 rounded-full md:block" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
