import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { CheckInSessionInsert } from "@/types/models";
import type {
  AttendingRegistration,
  CheckInSession,
} from "@/features/admin/types/checkInTypes";

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

export async function fetchAttendingRegistrations(
  supabase: DbClient,
  eventId: string
): Promise<AttendingRegistration[]> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select(
      `
      id,
      user_id,
      user_info!user_id(name, email)
    `
    )
    .eq("event_id", eventId)
    .eq("attending", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((reg) => {
    const userInfo = reg.user_info;
    return {
      id: reg.id,
      user_id: reg.user_id,
      user_name: userInfo?.name || "Unknown User",
      user_email: userInfo?.email || "",
    };
  });
}

/**
 * Returns a map keyed by `${registrationId}_${sessionId}` to the checked-in
 * timestamp (or null when not checked in).
 */
export async function fetchCheckInStatuses(
  supabase: DbClient,
  eventId: string
): Promise<Map<string, string | null>> {
  const { data: registrationsData, error: regsError } = await supabase
    .from(TABLES.eventRegistrations)
    .select("id")
    .eq("event_id", eventId);

  if (regsError) throw regsError;
  if (!registrationsData || registrationsData.length === 0) {
    return new Map();
  }

  const registrationIds = registrationsData.map((reg) => reg.id);

  const { data, error } = await supabase
    .from(TABLES.checkIns)
    .select("event_registration_id, check_in_session_id, checked_in_at")
    .in("event_registration_id", registrationIds);

  if (error) throw error;

  const statusMap = new Map<string, string | null>();
  (data || []).forEach(
    (checkIn: {
      event_registration_id: string;
      check_in_session_id: string;
      checked_in_at: string | null;
    }) => {
      const key = `${checkIn.event_registration_id}_${checkIn.check_in_session_id}`;
      statusMap.set(key, checkIn.checked_in_at);
    }
  );

  return statusMap;
}

/** Returns the check-in row id for a registration/session pair, or null. */
export async function fetchCheckInId(
  supabase: DbClient,
  registrationId: string,
  sessionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.checkIns)
    .select("id")
    .eq("event_registration_id", registrationId)
    .eq("check_in_session_id", sessionId)
    .maybeSingle();

  // PGRST116 means no matching row, which is expected.
  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data?.id ?? null;
}

export async function updateCheckInTimestamp(
  supabase: DbClient,
  checkInId: string,
  checkedInAt: string | null
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.checkIns)
    .update({ checked_in_at: checkedInAt })
    .eq("id", checkInId);

  if (error) throw error;
}

export async function insertCheckIn(
  supabase: DbClient,
  payload: {
    event_registration_id: string;
    check_in_session_id: string;
    checked_in_at: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from(TABLES.checkIns).insert(payload);
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
