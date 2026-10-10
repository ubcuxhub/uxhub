import type { EventGroup } from "@/features/events/types";
import { formatEventDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

export function groupEventsByMonth(events: EventRow[]): EventGroup[] {
  const groups = new Map<string, EventGroup>();

  for (const event of events) {
    if (!event.start_date) continue;

    const key = event.start_date.slice(0, 7);
    const label = formatEventDate(event.start_date, { day: undefined }) ?? key;

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

export function splitEventsByDate(events: EventRow[], today: string) {
  return {
    upcomingEvents: events.filter((e) => e.start_date && e.start_date >= today),
    pastEvents: events.filter((e) => e.start_date && e.start_date < today).reverse(),
  };
}
