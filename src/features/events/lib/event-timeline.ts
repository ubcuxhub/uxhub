import type { EventGroup, TimelineEvent } from "@/features/events/types";
import { formatEventDate, pacificDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

import { hasEventEnded } from "./event-rules";

/** Just the fields the timeline shows, for passing rows to the client. */
export function toTimelineEvent(event: TimelineEvent): TimelineEvent {
  const { id, slug, name, starts_at, ends_at, location_building, location_room, image_url } = event;
  return { id, slug, name, starts_at, ends_at, location_building, location_room, image_url };
}

export function groupEventsByMonth(events: TimelineEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();

  for (const event of events) {
    if (!event.starts_at) continue;

    const key = pacificDate(event.starts_at).slice(0, 7);
    const label = formatEventDate(event.starts_at, { day: undefined }) ?? key;

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