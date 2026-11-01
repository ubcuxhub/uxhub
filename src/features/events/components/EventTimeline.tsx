"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Switch } from "@/components/ui/switch";
import type { Status } from "@/components/ui/status-badge";
import type { EventRow } from "@/lib/supabase/models";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
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
  const searchRef = useRef<HTMLInputElement>(null);
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

  // group events by month
  const filteredGroups = groupEventsByMonth(filteredEvents);

  const clearSearch = () => {
    setSearchQuery("");
    searchRef.current?.focus();
  };

  return (
    <>
      <div className="mb-10 flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:gap-8">
        <SearchField
          ref={searchRef}
          label="Search events"
          placeholder="Search events"
          value={searchQuery}
          onValueChange={setSearchQuery}
          // Announce the count only while searching, not on every page load.
          resultCount={query ? filteredEvents.length : undefined}
        />
        <div className="flex w-fit shrink-0 items-center whitespace-nowrap text-foreground">
          <Label htmlFor={showPastId} className="mr-2">
            Show past events
          </Label>
          <Switch
            id={showPastId}
            checked={showPastEvents}
            onCheckedChange={setShowPastEvents}
          />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        query ? (
          <EmptyState
            size="inline"
            titleAs="h2"
            className="my-8"
            title={`No events match “${searchQuery.trim()}”`}
            description="Check the spelling, or try an event name or a venue."
            actions={
              <Button size="sm" variant="secondary" onClick={clearSearch}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            size="inline"
            titleAs="h2"
            className="my-8"
            title={showPastEvents ? "No past events" : "No events scheduled yet"}
          />
        )
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
