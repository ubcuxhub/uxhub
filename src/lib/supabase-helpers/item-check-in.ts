import type { DbClient } from "./types";
import { fetchAllPages } from "./all-pages";
import { TABLES } from "./tables";
import { fetchCheckInAttendees } from "./check-ins";
import type { ItemCheckInSnapshot, ItemCheckInResult } from "@/features/admin/lib/item-check-in";
import { formatUserName } from "@/lib/user-name";

/** Use a staff viewer client: activity and operator information are staff-only. */
export async function fetchItemCheckInSnapshot(client: DbClient, eventId: string, itemId: string | null): Promise<ItemCheckInSnapshot> {
  const [agenda, attendees] = await Promise.all([
    fetchAllPages((from, to) => client.from(TABLES.eventAgendaItems)
      .select("id,title,starts_at,ends_at,event_agenda_days!inner(event_id)")
      .eq("event_agenda_days.event_id", eventId).eq("check_in", true)
      .order("id").range(from, to)),
    fetchCheckInAttendees(client, eventId),
  ]);
  const items = agenda.map(item => ({ id: item.id, label: item.title, starts_at: item.starts_at, ends_at: item.ends_at }))
    .sort((a, b) => (a.starts_at ?? "\uffff").localeCompare(b.starts_at ?? "\uffff") || a.id.localeCompare(b.id));
  if (!itemId || !items.some(i => i.id === itemId))
    return { refreshedAt: new Date().toISOString(), items, attendees, attendance: [] };
  const sessions = await client.from(TABLES.checkInSessions).select("id").eq("event_id", eventId).eq("agenda_item_id", itemId).maybeSingle();
  if (sessions.error)
    throw sessions.error;
  if (!sessions.data)
    return { refreshedAt: new Date().toISOString(), items, attendees, attendance: [] };
  const [rows, activity] = await Promise.all([
    fetchAllPages((from, to) => client.from(TABLES.checkIns).select("ticket_id,attendance_version,checked_in_at").eq("check_in_session_id", sessions.data!.id).not("checked_in_at", "is", null).order("id").range(from, to)),
    fetchAllPages((from, to) => client.from(TABLES.checkInActivity).select("attendance_version,method,user_info!operator_id(first_name,last_name)").eq("event_id", eventId).eq("item_id", itemId).is("undone_at", null).order("attendance_version").range(from, to)),
  ]);
  const byVersion = new Map(activity.map(a => [a.attendance_version, a]));
  const validTickets = new Set(attendees.map(a => a.id));
  return {
    refreshedAt: new Date().toISOString(), items, attendees, attendance: rows.filter(r => r.checked_in_at && validTickets.has(r.ticket_id)).map(r => {
      const a = byVersion.get(r.attendance_version);
      return {
        ticketId: r.ticket_id, attendanceVersion: r.attendance_version, checkedInAt: r.checked_in_at!, method: a?.method as "scan" | "manual" | undefined ?? null,
        operator: a?.user_info ? formatUserName(a.user_info) : null
      };
    }).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
  };
}
export async function mutateItemCheckIn(client: DbClient, input: { eventId: string; itemId: string; ticketId?: string; code?: string; undoVersion?: string }): Promise<ItemCheckInResult | { status: "undone" } | { status: "stale_undo" }> {
  const { data, error } = await client.rpc("mutate_item_check_in", {
    p_event_id: input.eventId, p_item_id: input.itemId, p_ticket_id: input.ticketId,
    p_qr_token: input.code?.trim(), p_method: input.code !== undefined ? "scan" : "manual", p_undo_version: input.undoVersion,
  });
  if (error?.hint === "EVENT_CANCELED")
    return { status: "rejected", reason: "event_canceled" };
  if (error)
    throw error;
  return data as unknown as ItemCheckInResult | { status: "undone" } | { status: "stale_undo" };
}
