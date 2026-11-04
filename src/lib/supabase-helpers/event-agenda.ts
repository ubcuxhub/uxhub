import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventAgendaDayRow, EventAgendaItemRow } from "@/lib/supabase/models";

/**
 * Agenda tables are read-only for the browser roles: RLS shows an active
 * event's agenda to everyone and every agenda to admins, and there are no write
 * policies. Writes go through the service-role client.
 */

export interface EventAgendaDay extends EventAgendaDayRow {
  items: EventAgendaItemRow[];
}

/**
 * Returns an event's agenda days in date order, each with its items in start
 * time order. An event without an agenda returns an empty array.
 *
 * `building` and `room` stay null where an item uses the event's location.
 */
export async function fetchEventAgenda(
  supabase: DbClient,
  eventId: string
): Promise<EventAgendaDay[]> {
  const { data, error } = await supabase
    .from(TABLES.eventAgendaDays)
    .select("*, items:event_agenda_items(*)")
    .eq("event_id", eventId)
    .order("date", { ascending: true })
    .order("start_time", { referencedTable: "items", ascending: true });

  if (error) throw error;
  return data ?? [];
}
