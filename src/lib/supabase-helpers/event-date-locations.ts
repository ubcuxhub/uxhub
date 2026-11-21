import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventDateLocationSettingsRow } from "@/lib/supabase/models";
import { parseDateLocationDraft, type EventDateLocationDraft } from "@/features/admin/lib/event-date-location";

/** Staff-only editor data. Never use this helper in a public or member payload. */
export async function fetchEventDateLocationSettings(client: DbClient, eventId: string): Promise<(Omit<EventDateLocationSettingsRow, "document"> & { document: EventDateLocationDraft }) | null> {
  const { data, error } = await client.from(TABLES.eventDateLocationSettings).select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const document = parseDateLocationDraft(data.document);
  if (document.version === 2) {
    const sessions = await client.from(TABLES.checkInSessions).select("id, check_ins(id)").eq("event_id", eventId);
    if (sessions.error) throw sessions.error;
    const attended = new Set(sessions.data.filter(session => session.check_ins.length > 0).map(session => session.id));
    for (const day of document.dates) for (const item of day.items ?? []) item.attended = !!item.session_id && attended.has(item.session_id);
  }
  return { ...data, document, revision: data.revision };
}

export async function fetchEventRegistrationSettings(client: DbClient, eventId: string) {
  const [applications, pricing, counts] = await Promise.all([
    client.from(TABLES.eventApplications).select("id", { count: "exact", head: true }).eq("event_id", eventId).neq("status", "draft"),
    client.rpc("admin_event_pricing_locked", { p_event_id: eventId }),
    client.rpc("event_seat_counts", { p_event_ids: [eventId] }),
  ]);
  if (applications.error) throw applications.error;
  if (pricing.error) throw pricing.error;
  if (counts.error) throw counts.error;
  const row = counts.data?.[0];
  return { locked: !!applications.count || !!pricing.data, seats: (row?.tickets ?? 0) + (row?.held_offers ?? 0) };
}
