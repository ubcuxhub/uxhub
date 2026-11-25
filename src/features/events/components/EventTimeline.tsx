"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import type { EventBadge, TimelineEvent } from "@/features/events/types";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { writeEventsView } from "@/features/events/lib/events-view";
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
  /**
   * Now, as an ISO instant from the server (so the server and browser agree).
   * Upcoming events that have started by then are listed under Ongoing.
   */
  now?: string;
}

export function EventTimeline({
  upcomingEvents,
  pastEvents,
  badges = {},
  now,
}: EventTimelineProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  // The view lives in the URL (`?view=past`), so coming back from an event
  // opened from Past lands on Past again. `replaceState` updates it without a
  // server round trip or a new history entry.
  const searchParams = useSearchParams();
  const [showPastEvents, setShowPastEvents] = useState(searchParams.get("view") === "past");
  // Remember the view for this tab, so an event page's Back to Events returns
  // to it (the back button gets it from the URL).
  useEffect(() => writeEventsView(showPastEvents ? "past" : "upcoming"), [showPastEvents]);
  const showView = (view: string) => {
    const past = view === "past";
    setShowPastEvents(past);
    const params = new URLSearchParams(window.location.search);
    if (past) params.set("view", "past");
    else params.delete("view");
    const search = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`
    );
  };
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
  // Upcoming opens with Ongoing, the events already running, then each month
  // by start date. Past groups everything by the month it started.
  const filteredGroups = groupEventsByMonth(filteredEvents, {
    ongoingAt: showPastEvents ? undefined : now,
  });

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
        {/* Upcoming or Past (Figma 3759:15793): two views of the same list. */}
        <SegmentedToggle
          aria-label="Which events"
          size="lg"
          className="shrink-0"
          value={showPastEvents ? "past" : "upcoming"}
          onValueChange={showView}
        >
          <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
          <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
        </SegmentedToggle>
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
            title={showPastEvents ? "No past events" : "Events coming soon"}
          />
        )
      ) : (
        <EventTimelineRail
          className="mb-8"
          groups={filteredGroups}
          statusFor={(event) =>
            badges[event.id] ?? (showPastEvents ? "past" : null)
          }
        />
      )}
    </>
  );
}
