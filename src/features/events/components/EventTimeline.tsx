"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import { Switch } from "@/components/ui/switch";
import type { EventBadge, TimelineEvent } from "@/features/events/types";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { EventTimelineRail } from "./EventTimelineRail";

interface EventTimelineProps {
  /** Narrow rows with `toTimelineEvent` on the server: this is a client component. */
  upcomingEvents: TimelineEvent[];
  pastEvents: TimelineEvent[];
  /**
   * Each event's badge, keyed by event id; build it with `eventBadgeFor`.
   * An event without one shows "past" in the past list and no badge otherwise.
   */
  badges?: Record<string, EventBadge>;
}

export function EventTimeline({
  upcomingEvents,
  pastEvents,
  badges = {},
}: EventTimelineProps) {
  const showPastId = useId();
  const pastHeadingId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Search filters both sections.
  const query = normalizeString(searchQuery);
  const matches = (event: TimelineEvent) =>
    !query ||
    normalizeString(event.name).includes(query) ||
    (event.location_building && normalizeString(event.location_building).includes(query)) ||
    (event.location_room && normalizeString(event.location_room).includes(query));

  const filteredUpcoming = upcomingEvents.filter(matches);
  const filteredPast = showPastEvents ? pastEvents.filter(matches) : [];
  const resultCount = filteredUpcoming.length + filteredPast.length;

  // group events by month
  const upcomingGroups = groupEventsByMonth(filteredUpcoming);
  const pastGroups = groupEventsByMonth(filteredPast);

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
          resultCount={query ? resultCount : undefined}
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

      {resultCount === 0 ? (
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
            title="Events coming soon"
          />
        )
      ) : (
        <>
          {upcomingGroups.length > 0 ? (
            <EventTimelineRail
              className="mb-8"
              groups={upcomingGroups}
              statusFor={(event) => badges[event.id] ?? null}
            />
          ) : (
            // Only with the switch on and nothing searched: the past list
            // below is all there is, so say so rather than start it cold.
            !query && (
              <EmptyState
                size="inline"
                titleAs="h2"
                className="mb-8"
                title="No upcoming events"
              />
            )
          )}

          {showPastEvents && (!query || pastGroups.length > 0) && (
            <section aria-labelledby={pastHeadingId} className="mb-8">
              <h2
                id={pastHeadingId}
                className="mb-6 border-t border-border-subtle pt-8 text-h1 tracking-tight"
              >
                Past events
              </h2>
              {pastGroups.length > 0 ? (
                <EventTimelineRail
                  monthHeadingAs="h3"
                  groups={pastGroups}
                  statusFor={(event) => badges[event.id] ?? "past"}
                />
              ) : (
                <EmptyState size="inline" titleAs="h3" title="No past events" />
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
