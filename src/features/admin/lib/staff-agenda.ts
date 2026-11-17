import { checkInPath } from "./item-check-in";
import { pacificDate } from "@/lib/date";

/** Calendar dates can be nonconsecutive and span any number of weeks. */
export function defaultAgendaDayId(days: { id: string; date: string }[], now: Date): string | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const today = pacificDate(now.toISOString());
  return sorted.find(day => day.date === today)?.id
    ?? sorted.find(day => day.date > today)?.id
    ?? sorted.at(-1)?.id ?? null;
}

export function agendaPath(eventId: string, dayId?: string | null): string {
  return `/admin/events/${eventId}/agenda${dayId ? `?day=${encodeURIComponent(dayId)}` : ""}`;
}
export function selectedAgendaDayId(days: { id: string; date: string }[], explicit: string | undefined, now: Date): string | null {
  return days.find(day => day.id === explicit)?.id ?? defaultAgendaDayId(days, now);
}
export function agendaCheckInHref(eventId: string, itemId: string, dayId?: string): string {
  return checkInPath(eventId, itemId, false, agendaPath(eventId, dayId));
}
