import type { DbClient } from "./types";
import type { ParticipantLocation } from "@/lib/location";

export interface EventAgendaItem {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  description: string | null;
  check_in: boolean;
  location_overridden: boolean;
  location: ParticipantLocation | null;
}

export interface EventAgendaDay {
  id: string;
  date: string;
  title: string | null;
  location: ParticipantLocation | null;
  items: EventAgendaItem[];
}

export interface EventParticipantContent {
  location: ParticipantLocation | null;
  agenda: EventAgendaDay[];
}

/**
 * Pass the viewer's own client. The database authorizes the event and projects
 * active location fields before any HTML/RSC serialization. Never read the
 * editor settings or cache a ticket holder's projection for another viewer.
 */
export async function fetchEventParticipantContent(
  supabase: DbClient,
  eventId: string,
): Promise<EventParticipantContent> {
  const { data, error } = await supabase.rpc("event_participant_content", { p_event_id: eventId });
  if (error) throw error;
  // The RPC constructs this explicit projection, rather than serializing rows
  // or the private document. Its JSON shape is exercised by integration tests.
  return data as unknown as EventParticipantContent;
}
