import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventAgendaDay, EventAgendaItem } from "@/lib/supabase-helpers/event-agenda";

/** Participant day heading, for example "Sat, May 16th". */
export function agendaDayLabel(date: string): string {
  const day = Number(date.slice(-2));
  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${formatEventDate(date, { weekday: "short", month: "short", year: undefined })}${suffix}`;
}

/** Calendar-day arithmetic avoids DST/browser-timezone shifts in week boundaries. */
export function agendaWeeks(agenda: EventAgendaDay[]) {
  const days = [...agenda].sort((a, b) => a.date.localeCompare(b.date));
  const anchor = Date.parse(`${days[0]?.date}T00:00:00Z`);
  const weeks = new Map<number, EventAgendaDay[]>();
  for (const day of days) {
    const week = Math.floor((Date.parse(`${day.date}T00:00:00Z`) - anchor) / (7 * 86400000)) + 1;
    weeks.set(week, [...(weeks.get(week) ?? []), day]);
  }
  return [...weeks].map(([number, days]) => ({ number, days }));
}

export function agendaTimeRange(item: Pick<EventAgendaItem, "starts_at" | "ends_at">): string {
  if (!item.starts_at || !item.ends_at) return "Time to be confirmed";
  return `${formatEventTime(item.starts_at)} – ${formatEventTime(item.ends_at)}`;
}
