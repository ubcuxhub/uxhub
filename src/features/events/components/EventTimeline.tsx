"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedToggle, SegmentedToggleItem } from "@/components/ui/segmented-toggle";
import type { EventBadge } from "@/features/events/types";
import type { EventRow } from "@/lib/supabase/models";
import { groupEventsByMonth, normalizeString } from "@/features/events/lib/event-timeline";
import { EventTimelineRail } from "./EventTimelineRail";

interface EventTimelineProps {
  upcomingEvents: EventRow[];
  pastEvents: EventRow[];
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
  const searchRef = useRef<HTMLInputElement>(null);
  // The view lives in the URL (`?view=past`), so coming back from an event
  // opened from Past lands on Past again. `replaceState` updates it without a
  // server round trip or a new history entry.
  const searchParams = useSearchParams();
  const [showPastEvents, setShowPastEvents] = useState(searchParams.get("view") === "past");
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
