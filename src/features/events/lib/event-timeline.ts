import type { EventGroup } from "@/features/events/types";
import { formatEventDate, pacificDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

/**
 * Groups events under the Pacific month they start in. Pass `from` (a
 * `YYYY-MM` month, the current one for the upcoming list) to file anything
 * that started earlier, an event that's still running, under that month
 * instead, so the list starts at this month rather than at May for an
 * ongoing series. Events keep their order, so ongoing ones lead the month.
 */
export function groupEventsByMonth(
  events: EventRow[],
  { from }: { from?: string } = {}
): EventGroup[] {
  const groups = new Map<string, EventGroup>();

  for (const event of events) {
    if (!event.starts_at) continue;

    const startMonth = pacificDate(event.starts_at).slice(0, 7);
    const key = from && startMonth < from ? from : startMonth;
    const label =
      formatEventDate(key === startMonth ? event.starts_at : `${key}-01`, { day: undefined }) ?? key;

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