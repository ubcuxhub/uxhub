"use client";

import { useSyncExternalStore } from "react";

import { BackPill } from "@/components/shared/BackButton";

import { eventsHref, readEventsView, type EventsView } from "../lib/events-view";

// The view only changes on the timeline page, never while this link shows.
const subscribe = () => () => {};
const serverView = (): EventsView => "upcoming";

/**
 * "Back to Events" on an event page: a real link (§4.5) to the timeline view
 * the student came from, so an event opened from Past goes back to Past. The
 * server renders the Upcoming link, and the browser swaps in the remembered
 * view as it hydrates.
 */
export function EventsBackPill({ className }: { className?: string }) {
  const view = useSyncExternalStore(subscribe, readEventsView, serverView);
  return <BackPill href={eventsHref(view)} label="Back to Events" className={className} />;
}
