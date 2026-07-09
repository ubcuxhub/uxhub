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
import type {
  ApplicationStatus,
  GroupedRegistration,
} from "@/features/events/types/applicationTypes";

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

export async function countRegistrationsForEvent(
  supabase: DbClient,
  eventId: string,
  statuses?: ApplicationStatus[]
): Promise<number> {
  let query = supabase
    .from(TABLES.eventRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count ?? 0;
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

/** Returns the registration id for a user/event pair, or null if none. */
export async function fetchUserRegistrationId(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
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

export async function createEventRegistration(
  supabase: DbClient,
  payload: { event_id: string; user_id: string; status?: ApplicationStatus }
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .insert({
      event_id: payload.event_id,
      user_id: payload.user_id,
      status: payload.status ?? "pending",
    })
    .select("id")
    .single();

  if (error) {
    // Surface the postgres error so callers can branch on unique violations.
    throw error;
  }
  if (!data?.id) {
    throw new Error("No registration id returned from Supabase.");
  }
  return data.id;
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

export async function deleteRegistrationsForEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.eventRegistrations)
    .delete()
    .eq("event_id", eventId);

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
        name: userInfo?.name ?? "Unknown User",
        email: userInfo?.email ?? "",
        applicationDate: reg.created_at ?? "",
        status,
        registrationId: reg.id,
      });
    }
  }

  return Array.from(groupedMap.values());
}

export interface PurchaseHistoryItem {
  id: string;
  status: ApplicationStatus | null;
  created_at: string | null;
  event: {
    name: string;
    slug: string;
    regular_price: number;
    member_price: number;
    start_date: string | null;
    image_url: string | null;
  } | null;
}

/**
 * A user's event registrations with the related event details, newest first.
 * Powers the "my purchase history" section on the profile page.
 */
export async function fetchPurchaseHistoryForUser(
  supabase: DbClient,
  userId: string
): Promise<PurchaseHistoryItem[]> {
  const { data, error } = await supabase
    .from(TABLES.eventRegistrations)
    .select(
      `id, status, created_at,
       event:events!event_id(name, slug, regular_price, member_price, start_date, image_url)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PurchaseHistoryItem[];
}
