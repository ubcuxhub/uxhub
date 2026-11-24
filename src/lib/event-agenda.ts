import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventAgendaDay, EventAgendaItem } from "@/lib/supabase-helpers/event-agenda";

/** Agenda day heading and day tab label, for example "Sat, May 16" (Figma). */
export function agendaDayLabel(date: string): string {
  return formatEventDate(date, { weekday: "short", month: "short", year: undefined }) ?? date;
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

/**
 * A Pacific time range as the Figma agenda writes it: "8:00–9:00 AM" when both
 * ends share AM or PM, "10:30 AM–12:00 PM" when they don't.
 */
export function agendaTimeRange(item: Pick<EventAgendaItem, "starts_at" | "ends_at">): string {
  if (!item.starts_at || !item.ends_at) return "Time to be confirmed";
  const start = formatEventTime(item.starts_at) ?? "";
  const end = formatEventTime(item.ends_at) ?? "";
  const startParts = /^(.*)\s(AM|PM)$/.exec(start);
  const endParts = /^(.*)\s(AM|PM)$/.exec(end);
  return startParts && endParts && startParts[2] === endParts[2]
    ? `${startParts[1]}–${end}`
    : `${start}–${end}`;
}

/** One agenda tab: a week of days, or a single day. */
export interface AgendaPage {
  key: string;
  label: string;
  days: EventAgendaDay[];
}

/**
 * How the agenda paginates. One tab per week when the agenda spans several
 * weeks and any of them holds two or more days (a design sprint). Otherwise
 * one tab per day, labelled with the date: a weekend UXathon or a monthly
 * series. A single day makes one page, which the agenda shows without tabs.
 */
export function agendaPages(agenda: EventAgendaDay[]): AgendaPage[] {
  const weeks = agendaWeeks(agenda);
  if (weeks.length > 1 && weeks.some(week => week.days.length > 1)) {
    return weeks.map(({ number, days }) => ({ key: `week-${number}`, label: `Week ${number}`, days }));
  }
  return weeks.flatMap(week => week.days).map(day => ({ key: day.id, label: agendaDayLabel(day.date), days: [day] }));
}

/**
 * The tab the agenda opens on: the one holding `today` (a Pacific YYYY-MM-DD),
 * otherwise the next one, otherwise the last. The first without a date.
 */
export function defaultAgendaPage(pages: AgendaPage[], today?: string): string | undefined {
  if (!today) return pages[0]?.key;
  return (pages.find(page => today <= page.days[page.days.length - 1].date) ?? pages.at(-1))?.key;
}
