import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { TicketEvent } from "@/features/events/types";

type TicketEventSource = Pick<
  EventRow,
  | "name"
  | "start_date"
  | "end_date"
  | "start_time"
  | "end_time"
  | "location_building"
  | "location_room"
>;

function range(start: string | null, end: string | null): string | null {
  if (!start) return null;
  return end && end !== start ? `${start} – ${end}` : start;
}

export function toTicketEvent(event: TicketEventSource): TicketEvent {
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  return {
    name: event.name,
    date: range(
      formatEventDate(event.start_date),
      formatEventDate(event.end_date)
    ),
    time: range(
      formatEventTime(event.start_time),
      formatEventTime(event.end_time)
    ),
    location: location || null,
  };
}
