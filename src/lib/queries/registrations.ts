import { createClient } from "@/lib/supabase/client";
import type {
  ApplicationStatus,
  GroupedRegistration,
} from "@/features/events/types/applicationTypes";

/**
 * Fetches event registrations and groups them by user_id
 * Returns one entry per unique user with their latest registration
 */
export async function fetchEventRegistrationsGroupedByUser(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<GroupedRegistration[]> {
  const { data: registrationsData, error: registrationsError } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (registrationsError) throw registrationsError;
  if (!registrationsData || registrationsData.length === 0) return [];

  const userIds = [...new Set(registrationsData.map((reg) => reg.user_id))];

  const { data: usersData, error: usersError } = await supabase
    .from("user_info")
    .select("id, name, email")
    .in("id", userIds);

  if (usersError) throw usersError;

  const userMap = new Map((usersData || []).map((user) => [user.id, user]));

  const groupedMap = new Map<string, GroupedRegistration>();

  for (const reg of registrationsData) {
    const userId = reg.user_id;

    if (!groupedMap.has(userId)) {
      const userInfo = userMap.get(userId);
      const status = (reg.status as ApplicationStatus) || "pending";

      groupedMap.set(userId, {
        user_id: userId,
        name: userInfo?.name ?? "Unknown User",
        email: userInfo?.email ?? "",
        applicationDate: reg.created_at,
        status,
        registrationId: reg.id,
      });
    }
  }

  return Array.from(groupedMap.values());
}
