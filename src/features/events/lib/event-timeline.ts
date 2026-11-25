import type { EventGroup, TimelineEvent } from "@/features/events/types";
import { formatEventDate, pacificDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

import { hasEventEnded } from "./event-rules";

/** Just the fields the timeline shows, for passing rows to the client. */
export function toTimelineEvent(event: TimelineEvent): TimelineEvent {
  const { id, slug, name, starts_at, ends_at, location_building, location_room, image_url } = event;
  return { id, slug, name, starts_at, ends_at, location_building, location_room, image_url };
}

/** The key of the Ongoing group, which sorts ahead of the months. */
export const ONGOING_GROUP_KEY = "ongoing";

/**
 * Groups events under the Pacific month they start in. Pass `ongoingAt` (an
 * ISO instant, now, for the upcoming list) to gather the events that have
 * already started by then under "Ongoing" at the top instead: an event that
 * runs Nov 13–18 is Ongoing on Nov 16, while one on Nov 29 stays under
 * November. The upcoming list holds no ended events, so started means
 * running. Events keep their order within each group.
 */
export function groupEventsByMonth(
  events: TimelineEvent[],
  { ongoingAt }: { ongoingAt?: string } = {}
): EventGroup[] {
  const groups = new Map<string, EventGroup>();
  const cutoff = ongoingAt ? Date.parse(ongoingAt) : null;
  if (cutoff !== null && events.some((event) => event.starts_at && Date.parse(event.starts_at) <= cutoff)) {
    groups.set(ONGOING_GROUP_KEY, { key: ONGOING_GROUP_KEY, label: "Ongoing", events: [] });
  }

  for (const event of events) {
    if (!event.starts_at) continue;

    const ongoing = cutoff !== null && Date.parse(event.starts_at) <= cutoff;
    const key = ongoing ? ONGOING_GROUP_KEY : pacificDate(event.starts_at).slice(0, 7);
    const label = ongoing ? "Ongoing" : formatEventDate(event.starts_at, { day: undefined }) ?? key;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        events: [],
      });
    }

    groups.get(key)!.events.push(event);
  }

  return [...groups.values()];
}

/**
 * Dated events split into upcoming (soonest first, as given) and past (most
 * recent first). An event is past once it ends (`hasEventEnded`).
 */
export function splitEventsByTime<E extends Pick<EventRow, "starts_at" | "ends_at">>(events: E[], now: Date) {
  const isPast = (e: E) => hasEventEnded(e, now);
  const dated = events.filter((e) => e.starts_at);
  return {
    upcomingEvents: dated.filter((e) => !isPast(e)),
    pastEvents: dated.filter(isPast).reverse(),
  };
}

export function normalizeString(str: string | undefined) { 
  return (str ? str.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") : "");
}