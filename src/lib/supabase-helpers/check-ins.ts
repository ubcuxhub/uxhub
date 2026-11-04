import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  CheckInSessionInsert,
  EventTicketRow,
} from "@/lib/supabase/models";
import type {
  CheckInAttendee,
  CheckInSession,
} from "@/features/admin/types";
import { formatUserName } from "@/lib/user-name";

type CheckInAttendeeQueryRow = Pick<EventTicketRow, "id" | "user_id"> & {
  user_info: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

export async function fetchCheckInSessions(
  supabase: DbClient,
  eventId: string
): Promise<CheckInSession[]> {
  const { data, error } = await supabase
    .from(TABLES.checkInSessions)
    .select("id, name, start_time, end_time")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data || []) as CheckInSession[];
}

/** Everyone holding a ticket to the event, newest first. */
export async function fetchCheckInAttendees(
  supabase: DbClient,
  eventId: string
): Promise<CheckInAttendee[]> {
  const { data, error } = await supabase
    .from(TABLES.eventTickets)
    .select(
      `
      id,
      user_id,
      user_info!user_id(first_name, last_name, email)
    `
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((ticket: CheckInAttendeeQueryRow) => {
    const userInfo = ticket.user_info;
    return {
      id: ticket.id,
      user_id: ticket.user_id,
      user_name:
        userInfo?.first_name && userInfo.last_name
          ? formatUserName({
              first_name: userInfo.first_name,
              last_name: userInfo.last_name,
            })
          : "Unknown User",
      user_email: userInfo?.email || "",
    };
  });
}

/**
 * Returns a map keyed by `${ticketId}_${sessionId}` to the checked-in
 * timestamp, for every check-in on the event's tickets.
 */
export async function fetchCheckInStatuses(
  supabase: DbClient,
  eventId: string
): Promise<Map<string, string | null>> {
  const { data, error } = await supabase
    .from(TABLES.checkIns)
    .select(
      "ticket_id, check_in_session_id, checked_in_at, event_tickets!inner(event_id)"
    )
    .eq("event_tickets.event_id", eventId);

  if (error) throw error;

  const statusMap = new Map<string, string | null>();
  for (const checkIn of data ?? []) {
    if (!checkIn.ticket_id) continue;
    statusMap.set(
      `${checkIn.ticket_id}_${checkIn.check_in_session_id}`,
      checkIn.checked_in_at
    );
  }

  return statusMap;
}

/**
 * Checks a ticket in to a session now and returns the stored time. Checking
 * in again restamps it.
 */
export async function upsertCheckIn(
  supabase: DbClient,
  ticketId: string,
  sessionId: string
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLES.checkIns)
    .upsert(
      {
        ticket_id: ticketId,
        check_in_session_id: sessionId,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: "ticket_id,check_in_session_id" }
    )
    .select("checked_in_at")
    .single();

  if (error) throw error;
  return data.checked_in_at ?? new Date().toISOString();
}

/** Removes a mistaken check-in so the ticket can be checked in again. */
export async function deleteCheckIn(
  supabase: DbClient,
  ticketId: string,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.checkIns)
    .delete()
    .eq("ticket_id", ticketId)
    .eq("check_in_session_id", sessionId);

  if (error) throw error;
}

export async function insertCheckInSessions(
  supabase: DbClient,
  sessions: CheckInSessionInsert[]
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.checkInSessions)
    .insert(sessions);

  if (error) throw error;
}

export async function deleteCheckInSessionsForEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.checkInSessions)
    .delete()
    .eq("event_id", eventId);

  if (error) throw error;
}
