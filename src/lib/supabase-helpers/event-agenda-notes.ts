import type { ParticipantLocation, LocationDraft } from "@/lib/location";
import { parseDateLocationDraft } from "@/features/admin/lib/event-date-location";
import type { DbClient } from "./types";
import { TABLES } from "./tables";

export interface AgendaNote {
  item_id: string;
  body: string;
  revision: number;
}

export type SaveAgendaNoteResult = { ok: boolean; note: AgendaNote };

export interface StaffAgendaItem {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  check_in: boolean;
  location: ParticipantLocation | null;
  note: AgendaNote;
}

export interface StaffAgendaDay {
  id: string;
  date: string;
  title: string | null;
  location: ParticipantLocation | null;
  items: StaffAgendaItem[];
}

function staffLocation(location: LocationDraft | null | undefined): ParticipantLocation | null {
  if (!location) return null;
  return {
    type: location.type, restricted: false,
    ...(location.type !== "online" ? {
      building: location.building, room: location.room,
      address: location.address, map_url: location.map_url,
    } : {}),
    ...(location.type !== "in_person" ? {
      meeting_url: location.meeting_url, meeting_id: location.meeting_id,
      meeting_passcode: location.meeting_passcode,
    } : {}),
  };
}

/** Staff-only page data, independent of the participant display switch.
 * Pass the requesting staff member's client after the server authorization guard.
 * Settings and notes have their own staff-only RLS; descriptions are never notes.
 */
export async function fetchStaffAgenda(client: DbClient, eventId: string): Promise<StaffAgendaDay[]> {
  const [days, settings] = await Promise.all([
    client.from(TABLES.eventAgendaDays)
      .select("id,date,title,event_agenda_items(id,title,starts_at,ends_at,check_in)")
      .eq("event_id", eventId).order("date").order("id"),
    client.from(TABLES.eventDateLocationSettings).select("document")
      .eq("event_id", eventId).maybeSingle(),
  ]);
  if (days.error) throw days.error;
  if (settings.error) throw settings.error;
  const document = settings.data ? parseDateLocationDraft(settings.data.document) : null;
  const ids = days.data.flatMap(day => day.event_agenda_items.map(item => item.id));
  const notes = ids.length ? await client.from(TABLES.eventAgendaNotes)
    .select("item_id,body,revision").in("item_id", ids) : { data: [], error: null };
  if (notes.error) throw notes.error;
  const byItem = new Map((notes.data ?? []).map(note => [note.item_id, note]));
  return days.data.map(day => {
    const config = document?.dates.find(entry => entry.key === day.id);
    return {
      id: day.id, date: day.date, title: day.title,
      location: staffLocation(config?.location ?? document?.location),
      items: day.event_agenda_items.map(item => ({
        ...item,
        // The view resolves inheritance for the shared participant-style table.
        location: staffLocation(config?.items?.find(entry => entry.key === item.id)?.location),
        note: byItem.get(item.id) ?? { item_id: item.id, body: "", revision: 0 },
      })).sort((a, b) => (a.starts_at ?? "\uffff").localeCompare(b.starts_at ?? "\uffff") || a.id.localeCompare(b.id)),
    };
  });
}

/** Database authorization, event membership and compare-and-swap are atomic. */
export async function saveAgendaNote(client: DbClient, input: {
  eventId: string; itemId: string; body: string; expectedRevision: number;
}): Promise<SaveAgendaNoteResult> {
  const { data, error } = await client.rpc("save_agenda_note", {
    p_event_id: input.eventId, p_item_id: input.itemId,
    p_body: input.body, p_expected_revision: input.expectedRevision,
  });
  if (error) throw error;
  return data as unknown as SaveAgendaNoteResult;
}
