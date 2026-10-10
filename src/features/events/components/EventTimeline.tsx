"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { EventGroup } from "@/features/events/types";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import type { EventRow } from "@/lib/supabase/models";

interface EventTimelineProps {
  upcomingEventGroups: EventGroup[];
  pastEventGroups: EventGroup[];
}

export function EventTimeline({
  upcomingEventGroups,
  pastEventGroups,
}: EventTimelineProps) {
  const [showPastEvents, setShowPastEvents] = useState(false);

  const displayedGroups = showPastEvents ? pastEventGroups : upcomingEventGroups;
  const emptyMessage = showPastEvents ? "No past events." : "No events scheduled yet.";

  return (
    <>
      <div className="mb-4 flex items-center text-primary">
        <Label htmlFor="show-past-events" className="mr-2">
          Show Past Events
        </Label>
        <Switch
          id="show-past-events"
          checked={showPastEvents}
          onCheckedChange={setShowPastEvents}
        />
      </div>

      {displayedGroups.length === 0 ? (
        <p className="text-muted-foreground my-8">{emptyMessage}</p>
      ) : (
        <div className="mb-8">
          {displayedGroups.map((group) => (
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
  const timeRange = [formatEventTime(event.start_time), formatEventTime(event.end_time)]
    .filter(Boolean)
    .join(" - ");
  const dateTime = [
    formatEventDate(event.start_date, { month: "short", weekday: "short" }),
    timeRange,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex gap-3 sm:gap-8 sm:min-h-72">
      <div className="flex justify-end gap-4">
        <p className="hidden min-w-28 text-end sm:block">
          {formatEventDate(event.start_date, { year: undefined, month: "short" })}
        </p>
        <div className="flex flex-col items-center self-stretch">
          <div className="mt-2 size-2 shrink-0 rounded-full bg-fg-secondary" />
          <div className="flex-1 border-l-2 border-dashed border-subtle" />
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
