import Link from "next/link";
import { CalendarDays, ClipboardList, DollarSign, MapPin, Pencil, ScanLine, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Hubbo } from "@/components/shared/Hubbo";
import { EventPreview, EventPreviewSkeleton } from "@/components/shared/EventPreview";
import { formatEventDateRange } from "@/lib/date";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { safeContentUrl } from "@/features/admin/lib/event-content";
import { eventStateFor } from "@/features/events/lib/event-states";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { formatPrice } from "@/features/events/components/EventFactList";
import type { DashboardEvent } from "@/lib/supabase-helpers/admin-dashboard";
import type { EventSeatCount } from "@/lib/supabase-helpers/event-tickets";
import { DashboardEventPages } from "./DashboardEventPages";
import { DashboardEventRetry } from "./DashboardEventRecovery";

export const DashboardEventSkeleton = EventPreviewSkeleton;

export function DashboardEventUnavailable({ failed = false }: { failed?: boolean }) {
  return <Card className="justify-center gap-0 py-0 shadow-none lg:min-h-163">
    <EmptyState className="px-4 py-8 sm:px-6 sm:py-12" media={<Hubbo emotion={failed ? "thinking" : "resting"} className="h-24 sm:h-30" />}
      title={failed ? "We couldn’t load the upcoming event" : "No upcoming events"}
      description={failed ? "Something went wrong on our side. Try again in a moment." : "Create an event and its date, location and spots will show up here."}
      actions={failed ? <DashboardEventRetry /> : <Button asChild variant="secondary"><Link href="/admin/events/create-new">Create event</Link></Button>} />
  </Card>;
}

export function DashboardUpcomingEvent({ event, seats, showStudentLink, now }: {
  event: DashboardEvent | null; seats: EventSeatCount | null; showStudentLink: boolean; now: string;
}) {
  if (!event) return <DashboardEventUnavailable />;
  const state = eventStateFor(event, { ticket: null, application: null, seatsLeft: seats?.seatsLeft ?? null }, new Date(now));
  const location = event.location_type === "online" ? "Online" : [event.location_building, event.location_room].filter(Boolean).join(", ");
  const locationLabel = event.location_type === "hybrid" ? [location, "Online"].filter(Boolean).join(" and ") : location;
  const map = event.location_type !== "online" && event.location_address_url && safeContentUrl(event.location_address_url) ? event.location_address_url : null;
  const destination = publicMarketingDestination(event);
  const marketingHref = !showStudentLink || destination.kind === "none" ? null : destination.kind === "external" ? destination.url : `/events/${event.slug}`;
  const regular = event.regular_price;
  const member = event.member_price;
  const price = regular == null ? "Price to be confirmed" : member != null && member !== regular
    ? `${formatPrice(member)} for members, ${formatPrice(regular)} for non-members` : formatPrice(regular);
  const tickets = seats == null ? "Ticket count unavailable" : event.max_capacity == null
    ? `${seats.tickets.toLocaleString("en-CA")} tickets · Unlimited capacity`
    : `${seats.tickets.toLocaleString("en-CA")}/${event.max_capacity.toLocaleString("en-CA")} spots`;
  return <EventPreview title={event.name} href={`/admin/events/${event.id}/overview`} description={event.short_description}
    banner={{ src: event.header_image_url || (event.header_colour ? null : event.image_url), colour: event.header_colour }}
    status={<StatusBadge {...eventBadgeFor(state)} />}
    facts={[
      { label: "Date", icon: CalendarDays, value: formatEventDateRange(event.starts_at, event.ends_at) || "TBD" },
      { label: "Location", icon: MapPin, value: map ? <a href={map} target="_blank" rel="noopener noreferrer" className="rounded-sm underline underline-offset-4 transition-colors duration-fast hover:text-muted-foreground focus-visible:focus-ring">{locationLabel || "View on map"}</a> : locationLabel || "TBD" },
      { label: "Tickets and capacity", icon: User, value: tickets },
      { label: "Price", icon: DollarSign, value: price },
    ]}
    actions={<>
      <Button asChild><Link href={`/admin/events/${event.id}/check-in`}><ScanLine aria-hidden="true" />Check-in</Link></Button>
      {event.requires_application && <Button asChild variant="secondary"><Link href={`/admin/events/${event.id}/review-applications`}><ClipboardList aria-hidden="true" />Applications</Link></Button>}
      <Button asChild variant="secondary"><Link href={`/admin/events/${event.id}/edit`}><Pencil aria-hidden="true" />Edit event</Link></Button>
      <DashboardEventPages marketingHref={marketingHref} signupHref={showStudentLink ? `/portal/events/${event.slug}` : null} />
    </>} />;
}
