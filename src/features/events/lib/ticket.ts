import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { TicketEvent } from "@/features/events/types";

type TicketEventSource = Pick<
  EventRow,
  | "name"
  | "starts_at"
  | "ends_at"
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
      formatEventDate(event.starts_at),
      formatEventDate(event.ends_at)
    ),
    time: range(
      formatEventTime(event.starts_at),
      formatEventTime(event.ends_at)
    ),
    location: location || null,
  };
}
