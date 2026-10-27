import Link from "next/link";
import { CalendarDays, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardEvent } from "@/lib/supabase-helpers/admin-dashboard";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardEventSkeleton() {
  return <div role="status" aria-label="Loading upcoming event"><DashboardPanel className="min-h-64 justify-center gap-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-28 w-full" /></DashboardPanel></div>;
}

export function DashboardUpcomingEvent({ event, rsvpCount, showStudentLink }: {
  event: DashboardEvent | null; rsvpCount: number | null; showStudentLink: boolean;
}) {
  if (!event) return (
    <DashboardPanel className="min-h-64 items-center justify-center gap-3 text-center">
      <CalendarDays aria-hidden="true" className="size-8 text-fg-secondary" />
      <p className="text-h3">No upcoming events</p>
      <p className="text-small text-fg-secondary">Published upcoming events will appear here.</p>
    </DashboardPanel>
  );
  return (
    <DashboardPanel className="p-6 xl:p-10">
      <div className="flex flex-col gap-6 sm:flex-row lg:flex-col xl:flex-row xl:items-center">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt={event.name} className="aspect-square w-44 shrink-0 rounded border object-cover" />
        ) : <div className="flex aspect-square w-44 shrink-0 items-center justify-center rounded border bg-background text-fg-secondary"><CalendarDays aria-label="No event image" className="size-10" /></div>}
        <div className="min-w-0 space-y-4">
          <Badge className="rounded-sm border-0 bg-success-bg font-medium text-success hover:bg-success-bg">{rsvpCount == null ? "RSVPs unavailable" : `${rsvpCount.toLocaleString("en-CA")} RSVPs`}</Badge>
          <h3 className="text-h3 break-words">{event.name}</h3>
          {event.short_description && <p className="line-clamp-3 text-small">{event.short_description}</p>}
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-8 rounded-full px-4 text-small"><Link href={`/admin/events/${event.id}`}><Pencil aria-hidden="true" />Edit</Link></Button>
            {showStudentLink && <Button asChild className="h-8 rounded-full px-4 text-small"><Link href={`/portal/events/${event.slug}`}><ExternalLink aria-hidden="true" />See More</Link></Button>}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}
