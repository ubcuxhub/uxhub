import { pacificDate } from "@/lib/date";

/** Calendar dates can be nonconsecutive and span any number of weeks. */
export function defaultAgendaDayId(days: { id: string; date: string }[], now: Date): string | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const today = pacificDate(now.toISOString());
  return sorted.find(day => day.date === today)?.id
    ?? sorted.find(day => day.date > today)?.id
    ?? sorted.at(-1)?.id ?? null;
}

export function agendaCheckInHref(eventId: string, itemId: string): string {
  return `/admin/events/${eventId}/check-in?item=${encodeURIComponent(itemId)}`;
}
