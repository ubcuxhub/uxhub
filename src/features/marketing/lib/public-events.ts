import { splitEventsByTime } from "@/features/events/lib/event-timeline";
import { publicMarketingDestination } from "@/lib/event-marketing";
import type { EventRow } from "@/lib/supabase/models";

/** A published event on the public site, and where its card links. */
export interface ListedEvent {
  event: EventRow;
  href: string;
  /** The link leaves the site, so it opens in a new tab. */
  external: boolean;
}

/**
 * Published events as the public site lists them: those with a marketing page
 * (hosted here or external; one switched off is left out), split into
 * upcoming, soonest first, and past, most recent first. Pass the events in
 * start order. An event in progress is still upcoming, as on the portal
 * timeline.
 */
export function listPublicEvents(
  events: EventRow[],
  now: Date
): { upcoming: ListedEvent[]; past: ListedEvent[] } {
  const listed = (group: EventRow[]) =>
    group.flatMap((event): ListedEvent[] => {
      const destination = publicMarketingDestination(event);
      if (destination.kind === "none") return [];
      return destination.kind === "external"
        ? [{ event, href: destination.url, external: true }]
        : [{ event, href: `/events/${event.slug || event.id}`, external: false }];
    });
  const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
  return { upcoming: listed(upcomingEvents), past: listed(pastEvents) };
}
