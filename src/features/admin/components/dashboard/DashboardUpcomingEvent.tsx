import Link from "next/link";
import { CalendarDays, ChevronDown, ClipboardList, DollarSign, ExternalLink, MapPin, Pencil, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatEventDate } from "@/lib/date";
import type { DashboardEvent } from "@/lib/supabase-helpers/admin-dashboard";
import { DashboardPanel } from "./DashboardPanel";

const actionClassName = "h-auto min-h-16 w-full min-w-0 justify-start whitespace-normal rounded-md px-4 py-3 text-left text-small sm:h-auto";

function formatPrice(price: number) {
  return price === 0 ? "Free" : `$${price.toFixed(2)}`;
}

export function DashboardEventSkeleton() {
  return (
    <div role="status" aria-label="Loading upcoming event">
      <DashboardPanel className="min-h-64 justify-center gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-28 w-full" />
      </DashboardPanel>
    </div>
  );
}

export function DashboardUpcomingEvent({ event, rsvpCount, showStudentLink }: {
  event: DashboardEvent | null;
  rsvpCount: number | null;
  showStudentLink: boolean;
}) {
  if (!event) return (
    <DashboardPanel className="min-h-64 items-center justify-center gap-3 text-center">
      <CalendarDays aria-hidden="true" className="size-8 text-fg-secondary" />
      <p className="text-h3">No upcoming events</p>
      <p className="text-small text-fg-secondary">Published upcoming events will appear here.</p>
    </DashboardPanel>
  );
  const location = [event.location_building, event.location_room].filter(Boolean).join(", ");
  const hasMemberPrice = event.member_price != null && Number(event.member_price) !== Number(event.regular_price);
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
        </div>
      </div>
      <Separator className="my-6" />
      <dl aria-label="Event details" className="flex flex-col gap-4 text-small">
        <div className="flex items-center gap-3">
          <dt className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <CalendarDays aria-hidden="true" className="size-4 text-fg-secondary" />
            <span className="sr-only">Date</span>
          </dt>
          <dd>{formatEventDate(event.start_date, { weekday: "long" }) || "TBD"}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <MapPin aria-hidden="true" className="size-4 text-fg-secondary" />
            <span className="sr-only">Location</span>
          </dt>
          <dd className="min-w-0 break-words">
            {location && event.location_address_url ? (
              <a href={event.location_address_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-primary">
                {location}<ExternalLink aria-hidden="true" className="ml-1 inline size-3.5" />
              </a>
            ) : location || "TBD"}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <DollarSign aria-hidden="true" className="size-4 text-fg-secondary" />
            <span className="sr-only">Price</span>
          </dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{formatPrice(Number(event.regular_price))}</span>
            {hasMemberPrice && (
              <span className="text-fg-secondary">
                Members: <span className="text-success">{formatPrice(Number(event.member_price))}</span>
              </span>
            )}
          </dd>
        </div>
      </dl>
      <Separator className="my-6" />
      <section aria-label="Quick Actions" className="w-full space-y-4">
        <h4 className="text-small font-semibold">Quick Actions</h4>
        <div className="grid w-full grid-cols-2 gap-4">
          <Button asChild className={actionClassName}>
            <Link href={`/admin/events/${event.id}/check-in`}>
              <ScanLine aria-hidden="true" />
              <span className="min-w-0">Check-in Participants</span>
            </Link>
          </Button>
          <Button asChild className={actionClassName}>
            <Link href={`/admin/events/${event.id}/review-applications`}>
              <ClipboardList aria-hidden="true" />
              <span className="min-w-0">Review Applications</span>
            </Link>
          </Button>
          <Button asChild className={actionClassName}>
            <Link href={`/admin/events/${event.id}`}>
              <Pencil aria-hidden="true" />
              <span className="min-w-0">Edit Event Details</span>
            </Link>
          </Button>
          {showStudentLink && (
            <Popover>
              <PopoverTrigger asChild>
                <Button className={actionClassName}>
                  <ExternalLink aria-hidden="true" />
                  <span className="min-w-0">View Event Page</span>
                  <ChevronDown aria-hidden="true" className="ml-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" aria-label="View Event Page" className="w-48 p-1">
                <nav aria-label="Event pages" className="flex flex-col">
                  <Button asChild variant="ghost" className="justify-start">
                    <Link href={`/events/${event.slug}`}>Marketing Page</Link>
                  </Button>
                  <Button asChild variant="ghost" className="justify-start">
                    <Link href={`/portal/events/${event.slug}`}>Sign-up Page</Link>
                  </Button>
                </nav>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </section>
    </DashboardPanel>
  );
}
