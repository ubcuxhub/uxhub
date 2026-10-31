"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatEventDate, formatEventTime, pacificDate } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import type { EventRow } from "@/lib/supabase/models";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { Input } from "@/components/ui/input";

interface EventTimelineProps {
  upcomingEvents: EventRow[];
  pastEvents: EventRow[];
}

export function EventTimeline({
  upcomingEvents,
  pastEvents,
}: EventTimelineProps) {
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
    <div>
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-8 mb-20">
        <Input
          placeholder="Search events..."
          aria-label="Search events"
          value={searchQuery}
          onChange={(e) => {setSearchQuery(e.target.value)}}
          type="search"
          className="w-full"
        />
        <div className="w-fit flex items-center text-primary">
          <Label htmlFor="show-past-events" className="mr-2">
            Show Past Events
          </Label>
          <Switch
            id="show-past-events"
            checked={showPastEvents}
            onCheckedChange={setShowPastEvents}
          />
        </div>
      </div>
    </div>

      {filteredGroups.length === 0 ? (
        <p className="text-muted-foreground my-8">{emptyMessage}</p>
      ) : (
        <div className="mb-8">
          {filteredGroups.map((group) => (
            <div key={group.key}>
              <h2 className="mt-4 mb-5 text-h2">{group.label}</h2>
              {group.events.map((event) => (
                <EventTimelineItem key={event.id} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EventTimelineItem({ event }: { event: EventRow }) {
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");
  const dateOptions = { month: "short", weekday: "short" } as const;
  const endDate =
    pacificDate(event.ends_at) !== pacificDate(event.starts_at)
      ? formatEventDate(event.ends_at, dateOptions)
      : null;
  const startDateTime = [
    formatEventDate(event.starts_at, dateOptions),
    formatEventTime(event.starts_at),
  ]
    .filter(Boolean)
    .join(" ");
  const endDateTime = [endDate, formatEventTime(event.ends_at)]
    .filter(Boolean)
    .join(" ");
  const dateTime = [startDateTime, endDateTime].filter(Boolean).join(" – ");

  return (
    <div className="flex gap-3 sm:gap-8 sm:min-h-72">
      <div className="flex justify-end gap-4">
        <p className="hidden min-w-28 text-end sm:block">
          {formatEventDate(event.starts_at, { year: undefined, month: "short" })}
        </p>
        <div className="flex flex-col items-center self-stretch">
          <div className="mt-2 size-2 shrink-0 rounded-full bg-fg-secondary" />
          <div className="flex-1 border-l-2 border-dashed border-border-subtle" />
        </div>
      </div>

      <Link
        href={`/portal/events/${event.slug}`}
        className="flex w-full min-w-0 self-start items-center justify-between gap-6 rounded-xl border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-52 sm:px-5"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h3 className="text-h3">{event.name}</h3>
            {location && <p>{location}</p>}
            {dateTime && <p>{dateTime}</p>}
          </div>
        </div>
        <div className="size-20 shrink-0 overflow-hidden rounded-3xl bg-muted sm:size-40">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImagePreviewSrc(event.image_url)}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Calendar className="text-muted-foreground" />
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
