"use client";

import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Status } from "@/components/ui/status-badge";
import type { EventRow } from "@/lib/supabase/models";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { Input } from "@/components/ui/input";
import { EventTimelineRail } from "./EventTimelineRail";

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
        <EventTimelineRail
          className="mb-8"
          groups={filteredGroups}
          // Without a `statusFor`, only "past" is known: the member's own
          // status (going, waitlisted, ...) isn't loaded here.
          statusFor={(event) =>
            statusFor ? statusFor(event) : showPastEvents ? "past" : null
          }
        />
      )}
    </>
  );
}
