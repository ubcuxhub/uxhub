import type { PacificNow } from "@/hooks/use-pacific-now";

/** True when `now` falls on the agenda day's date. */
export function isAgendaDayToday(dayDate: string, now: PacificNow | null): boolean {
  return now?.date === dayDate;
}

/**
 * True while an agenda item is running: on its day, from its start time up to
 * but not including its end time. Item times are Postgres `time` strings
 * ("09:30:00"); only the hours and minutes are compared.
 */
export function isAgendaItemHappening(
  dayDate: string,
  item: { start_time: string; end_time: string },
  now: PacificNow | null
): boolean {
  if (!now || now.date !== dayDate) return false;
  return item.start_time.slice(0, 5) <= now.time && now.time < item.end_time.slice(0, 5);
}
