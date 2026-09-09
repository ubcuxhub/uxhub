import type { DbClient } from "./types";
import { TABLES } from "./tables";
import {
  fetchUserInfoContactsByIds,
  type UserInfoContact,
} from "./users";
import type {
  EventRegistrationRow,
  EventRegistrationUpdate,
} from "@/types/models";
import type { GroupedRegistration } from "@/features/events/types/applicationTypes";
import { formatUserName } from "@/lib/user-name";
import type { ApplicationStatus } from "@/types/models";

export async function fetchEventRegistrationById(
  supabase: DbClient,
  registrationId: string
): Promise<EventRegistrationRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchRegistrationsForEvent(
  supabase: DbClient,
  eventId: string
): Promise<EventRegistrationRow[]> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("event_id", eventId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchEventRegistrationCount(
  supabase: DbClient,
  eventId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Registration totals for many events in one round trip.
 *
 * The listing pages that need counts for a whole table would otherwise issue
 * one head query per event, so this defers to the `event_registration_counts`
 * function, which aggregates in Postgres under the caller's own RLS.
 *
 * Events with no registrations are absent from the result, so every requested
 * id is seeded to zero before the returned rows are folded in.
 */
export async function fetchEventRegistrationCounts(
  supabase: DbClient,
  eventIds: string[]
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("event_registration_counts", {
    p_event_ids: eventIds,
  });

  if (error) throw error;

  const counts = new Map<string, number>(eventIds.map((id) => [id, 0]));

  for (const row of data ?? []) {
    // PostgREST can serialize bigint as a string.
    counts.set(row.event_id, Number(row.registration_count));
  }

  return counts;
}

/** Returns all event registrations for a given user. */
export async function fetchRegistrationsForUser(
  supabase: DbClient,
  userId: string
): Promise<EventRegistrationRow[]> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserRegistration(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<EventRegistrationRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchEventRegistrationByPurchaseId(
  supabase: DbClient,
  purchaseId: string
): Promise<EventRegistrationRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("purchase_id", purchaseId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateEventRegistration(
  supabase: DbClient,
  registrationId: string,
  payload: EventRegistrationUpdate
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.eventRegistrations)
    .update(payload)
    .eq("id", registrationId);

  if (error) throw error;
}

/**
 * Fetches event registrations and groups them by user, returning one entry
 * per unique user with their latest registration.
 */
export async function fetchEventRegistrationsGroupedByUser(
  supabase: DbClient,
  eventId: string
): Promise<GroupedRegistration[]> {
  const { data: registrationsData, error: registrationsError } = await supabase
    .from(TABLES.eventRegistrations)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (registrationsError) throw registrationsError;
  if (!registrationsData || registrationsData.length === 0) return [];

  const userIds = Array.from(
    new Set<string>(
      registrationsData.map((reg: EventRegistrationRow) => reg.user_id)
    )
  );
  const usersData = await fetchUserInfoContactsByIds(supabase, userIds);
  const userMap = new Map(
    usersData.map((user: UserInfoContact) => [user.id, user])
  );

  const groupedMap = new Map<string, GroupedRegistration>();

  for (const reg of registrationsData) {
    const userId = reg.user_id;

    if (!groupedMap.has(userId)) {
      const userInfo = userMap.get(userId);
      const status = (reg.status as ApplicationStatus) || "pending";

      groupedMap.set(userId, {
        user_id: userId,
        name: userInfo ? formatUserName(userInfo) : "Unknown User",
        email: userInfo?.email ?? "",
        applicationDate: reg.created_at ?? "",
        status,
        registrationId: reg.id,
      });
    }
  }

  return Array.from(groupedMap.values());
}
