import { createClient } from "@/lib/supabase/client";
import type { ApplicationStatus } from "@/components/ApplicationListCard";

export interface RegistrationWithUser {
  id: string;
  event_id: string;
  user_id: string;
  status: string; // enum: "pending", "accepted", "declined"
  reviewer_id: string | null;
  created_at: string;
  user_info: {
    id: string;
    name: string;
    email: string;
  };
}

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}

/**
 * Fetches event registrations and groups them by user_id
 * Returns one entry per unique user with their latest registration
 */
export async function fetchEventRegistrationsGroupedByUser(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<GroupedRegistration[]> {
  // Fetch all registrations for this event
  const { data: registrationsData, error: registrationsError } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (registrationsError) throw registrationsError;
  if (!registrationsData || registrationsData.length === 0) return [];

  // Get unique user IDs
  const userIds = [...new Set(registrationsData.map((reg) => reg.user_id))];

  // Fetch user info for all unique users
  const { data: usersData, error: usersError } = await supabase
    .from("user_info")
    .select("id, name, email")
    .in("id", userIds);

  if (usersError) throw usersError;

  // Create a map of user info
  const userMap = new Map((usersData || []).map((user) => [user.id, user]));

  // Group by user_id and get the most recent registration for each user
  const groupedMap = new Map<string, GroupedRegistration>();

  for (const reg of registrationsData) {
    const userId = reg.user_id;

    // Only keep the first (most recent) registration for each user
    if (!groupedMap.has(userId)) {
      const userInfo = userMap.get(userId);
      // Read status directly from the registration
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
