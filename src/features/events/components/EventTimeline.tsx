"use client";

import { useId, useState } from "react";

import { EventCard, EventCardDates } from "@/components/shared/EventCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatEventDateLabel, formatEventDateTimeLines } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import type { Status } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/lib/supabase/models";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { Input } from "@/components/ui/input";

interface EventTimelineProps {
  upcomingEvents: EventRow[];
  pastEvents: EventRow[];
  /**
   * The badge for an event's card, e.g. the member's own status ("going",
   * "waitlisted"). Defaults to "past" for past events and no badge otherwise.
   */
  statusFor?: (event: EventRow) => Status | null;
}

export function EventTimeline({
  upcomingEvents,
  pastEvents,
  statusFor,
}: EventTimelineProps) {
  const showPastId = useId();
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const displayedEvents = showPastEvents ? pastEvents : upcomingEvents;
  
  // filter events based on search query
  const query = normalizeString(searchQuery);
  const filteredEvents = (query) ? displayedEvents.filter((event) => {
    return (
      normalizeString(event.name).includes(query) ||
      (event.location_building && normalizeString(event.location_building).includes(query)) ||
      (event.location_room && normalizeString(event.location_room).includes(query))
    )
  }) : displayedEvents;
  
  const emptyMessage = query ? `No events match "${searchQuery}".` : showPastEvents ? "No past events." : "No events scheduled yet.";

  // group events by month
  const filteredGroups = groupEventsByMonth(filteredEvents);

  return (
    <>
      <div className="mb-10 flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:gap-8">
        <Input
          placeholder="Search events..."
          aria-label="Search events"
          value={searchQuery}
          onChange={(e) => {setSearchQuery(e.target.value)}}
          type="search"
          className="w-full"
        />
        <div className="flex w-fit shrink-0 items-center whitespace-nowrap text-primary">
          <Label htmlFor={showPastId} className="mr-2">
            Show Past Events
          </Label>
          <Switch
            id={showPastId}
            checked={showPastEvents}
            onCheckedChange={setShowPastEvents}
          />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="text-muted-foreground my-8">{emptyMessage}</p>
      ) : (
        <div className="mb-8 flex flex-col gap-10">
          {filteredGroups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-4 text-h2">{group.label}</h2>
              <ol>
                {group.events.map((event, index) => (
                  <EventTimelineRow
                    key={event.id}
                    event={event}
                    // Without a `statusFor`, only "past" is known: the member's
                    // own status (going, waitlisted, ...) isn't loaded here.
                    status={
                      statusFor
                        ? statusFor(event)
                        : showPastEvents
                          ? "past"
                          : null
                    }
                    isLast={index === group.events.length - 1}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * One row of the design-system rail (§3.9): the date marker, a dashed rail
 * with a dot, then the EventCard. On phones the rail hides and the date sits
 * above the card.
 */
function EventTimelineRow({
  event,
  status,
  isLast,
}: {
  event: EventRow;
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
        href={`/portal/events/${event.slug}`}
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
