import { EventCard, EventCardDates } from "@/components/shared/EventCard";
import type { Status } from "@/components/ui/status-badge";
import type { EventGroup } from "@/features/events/types";
import { formatEventDateLabel, formatEventDateTimeLines } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import type { EventRow } from "@/lib/supabase/models";
import { cn } from "@/lib/utils";

interface EventTimelineRailProps {
  /** Events already grouped by month, see `groupEventsByMonth`. */
  groups: EventGroup[];
  /** The badge for an event's card; return `null` for none. */
  statusFor: (event: EventRow) => Status | null;
  /** Where a card links. Defaults to the portal event page. */
  hrefFor?: (event: EventRow) => string;
  className?: string;
}

const portalHref = (event: EventRow) => `/portal/events/${event.slug}`;

/**
 * The presentational half of the events timeline (§3.9): a heading per month,
 * then one row per event with its date marker, a dashed rail and the EventCard.
 * It owns no search, switch or empty state; `EventTimeline` supplies those and
 * the design-system gallery composes the rail under its own controls.
 */
export function EventTimelineRail({
  groups,
  statusFor,
  hrefFor = portalHref,
  className,
}: EventTimelineRailProps) {
  return (
    <div className={cn("flex flex-col gap-10", className)}>
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-4 text-h2">{group.label}</h2>
          <ol>
            {group.events.map((event, index) => (
              <EventTimelineRow
                key={event.id}
                event={event}
                href={hrefFor(event)}
                status={statusFor(event)}
                isLast={index === group.events.length - 1}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * One row of the rail: the date marker, a dashed rail with a dot, then the
 * EventCard. On phones the rail hides and the date sits above the card.
 */
function EventTimelineRow({
  event,
  href,
  status,
  isLast,
}: {
  event: EventRow;
  href: string;
  status: Status | null;
  isLast: boolean;
}) {
  const venue = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="grid gap-y-2 pb-6 sm:grid-cols-[7.5rem_1.5rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0">
      <p className="text-body font-medium text-foreground sm:pt-1 sm:font-normal">
        {formatEventDateLabel(event.starts_at, event.ends_at)}
      </p>
      <div aria-hidden className="relative hidden sm:block">
        <div
          className={cn(
            "absolute top-2 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-border",
            // The line bridges the 24px gap to the next row, and stops at the
            // card's bottom edge on the last one.
            isLast ? "bottom-0" : "-bottom-6",
          )}
        />
        <div className="absolute top-1 left-2 size-2 rounded-full bg-muted-foreground" />
      </div>
      <EventCard
        title={event.name}
        href={href}
        venue={venue || null}
        when={
          <EventCardDates
            lines={formatEventDateTimeLines(event.starts_at, event.ends_at)}
          />
        }
        status={status}
        image={
          event.image_url
            ? { src: resolveImagePreviewSrc(event.image_url) }
            : null
        }
      />
    </li>
  );
}
