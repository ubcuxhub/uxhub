import { createClient } from "@/lib/supabase/client";
import type {
  AttendingRegistration,
  CheckInSession,
} from "../types/checkInTypes";

export async function fetchCheckInSessions(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<CheckInSession[]> {
  const { data, error } = await supabase
    .from("check_in_sessions")
    .select("id, name, start_time, end_time")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data || []) as CheckInSession[];
}

export async function fetchAttendingRegistrations(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<AttendingRegistration[]> {
  const { data, error } = await supabase
    .from("event_registrations")
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

  return data.map(
    (reg: {
      id: string;
      user_id: string;
      user_info: { name: string; email: string }[] | null;
    }) => {
      const userInfo = Array.isArray(reg.user_info)
        ? reg.user_info[0] || null
        : reg.user_info;
      return {
        id: reg.id,
        user_id: reg.user_id,
        user_name: userInfo?.name || "Unknown User",
        user_email: userInfo?.email || "",
      };
    }
  );
}

export async function fetchCheckInStatuses(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<Map<string, string | null>> {
  const { data: registrationsData, error: regsError } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("event_id", eventId);

  if (regsError) throw regsError;
  if (!registrationsData || registrationsData.length === 0) {
    return new Map();
  }

  const registrationIds = registrationsData.map((reg) => reg.id);

  const { data, error } = await supabase
    .from("check_ins")
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
