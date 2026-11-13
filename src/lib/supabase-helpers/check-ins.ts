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

type AttendeeNameFields = {
  first_name: string | null;
  last_name: string | null;
} | null;

/** The ticket a scan or a manual lookup points at. */
export interface CheckInTicket {
  id: string;
  event_id: string;
  user_name: string;
}

export interface CheckInRecord {
  checkedInAt: string;
  /** True when an earlier check-in already set `checkedInAt`. */
  alreadyCheckedIn: boolean;
}

const CHECK_IN_TICKET_COLUMNS =
  "id, event_id, user_info!user_id(first_name, last_name)";

// The row can only vanish between two reads if an admin un-checks the ticket
// at that moment, so one retry is nearly always enough.
const CHECK_IN_ATTEMPTS = 3;

function attendeeName(userInfo: AttendeeNameFields): string {
  return userInfo?.first_name && userInfo.last_name
    ? formatUserName({
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
      })
    : "Unknown User";
}

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

  return data.map((ticket: CheckInAttendeeQueryRow) => ({
    id: ticket.id,
    user_id: ticket.user_id,
    user_name: attendeeName(ticket.user_info),
    user_email: ticket.user_info?.email || "",
  }));
}

/** The ticket whose QR code holds `qrToken`, or null when no ticket does. */
export async function fetchCheckInTicketByToken(
  supabase: DbClient,
  qrToken: string
): Promise<CheckInTicket | null> {
  const { data, error } = await supabase
    .from(TABLES.eventTickets)
    .select(CHECK_IN_TICKET_COLUMNS)
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (error) throw error;
  return data && toCheckInTicket(data);
}

export async function fetchCheckInTicketById(
  supabase: DbClient,
  ticketId: string
): Promise<CheckInTicket | null> {
  const { data, error } = await supabase
    .from(TABLES.eventTickets)
    .select(CHECK_IN_TICKET_COLUMNS)
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw error;
  return data && toCheckInTicket(data);
}

function toCheckInTicket(
  row: Pick<EventTicketRow, "id" | "event_id"> & { user_info: AttendeeNameFields }
): CheckInTicket {
  return {
    id: row.id,
    event_id: row.event_id,
    user_name: attendeeName(row.user_info),
  };
}

/** The event a check-in session belongs to, or null if the session is gone. */
export async function fetchCheckInSessionEventId(
  supabase: DbClient,
  sessionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.checkInSessions)
    .select("event_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data?.event_id ?? null;
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
 * Checks a ticket in to a session, keeping the first time. Checking in again
 * returns that time with `alreadyCheckedIn`, and of two simultaneous calls
 * only one records the check-in: the insert skips an existing row on the
 * unique (ticket, session) pair, and the update only takes a row whose time
 * is still empty, so Postgres settles each race.
 */
export async function checkInTicket(
  supabase: DbClient,
  ticketId: string,
  sessionId: string
): Promise<CheckInRecord> {
  const checkedInAt = new Date().toISOString();

  for (let attempt = 0; attempt < CHECK_IN_ATTEMPTS; attempt++) {
    const { data: inserted, error: insertError } = await supabase
      .from(TABLES.checkIns)
      .upsert(
        {
          ticket_id: ticketId,
          check_in_session_id: sessionId,
          checked_in_at: checkedInAt,
        },
        { onConflict: "ticket_id,check_in_session_id", ignoreDuplicates: true }
      )
      .select("checked_in_at");

    if (insertError) throw insertError;
    if (inserted[0]?.checked_in_at) {
      return { checkedInAt: inserted[0].checked_in_at, alreadyCheckedIn: false };
    }

    const { data: existing, error: existingError } = await supabase
      .from(TABLES.checkIns)
      .select("checked_in_at")
      .eq("ticket_id", ticketId)
      .eq("check_in_session_id", sessionId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.checked_in_at) {
      return { checkedInAt: existing.checked_in_at, alreadyCheckedIn: true };
    }
    if (!existing) continue;

    // Un-checking used to clear the time instead of deleting the row.
    const { data: stamped, error: stampError } = await supabase
      .from(TABLES.checkIns)
      .update({ checked_in_at: checkedInAt })
      .eq("ticket_id", ticketId)
      .eq("check_in_session_id", sessionId)
      .is("checked_in_at", null)
      .select("checked_in_at");

    if (stampError) throw stampError;
    if (stamped[0]?.checked_in_at) {
      return { checkedInAt: stamped[0].checked_in_at, alreadyCheckedIn: false };
    }
  }

  throw new Error("The check-in kept changing while it was being recorded.");
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
