import type { EventGroup } from "@/features/events/types";
import { formatEventDate, pacificDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

export function groupEventsByMonth(events: EventRow[]): EventGroup[] {
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

/** An event is past once it ends, or once it starts if it has no end. */
export function splitEventsByTime(events: EventRow[], now: Date) {
  const isPast = (e: EventRow) => Date.parse(e.ends_at ?? e.starts_at!) < now.getTime();
  const dated = events.filter((e) => e.starts_at);
  return {
    upcomingEvents: dated.filter((e) => !isPast(e)),
    pastEvents: dated.filter(isPast).reverse(),
  };
}

export function normalizeString(str: string | undefined) { 
  return (str ? str.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") : "");
}