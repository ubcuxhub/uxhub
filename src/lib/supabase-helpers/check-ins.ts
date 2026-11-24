import type { DbClient } from "./types";
import { fetchAllPages } from "./all-pages";
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
  const data = await fetchAllPages<CheckInAttendeeQueryRow>((from, to) => supabase
    .from(TABLES.eventTickets)
    .select("id,user_id,user_info!user_id(first_name,last_name,email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false }).order("id")
    .range(from, to));

  return data.map((ticket: CheckInAttendeeQueryRow) => ({
    id: ticket.id,
    user_id: ticket.user_id,
    user_name: attendeeName(ticket.user_info),
    user_email: ticket.user_info?.email || "",
  }));
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
