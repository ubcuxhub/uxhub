import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventRegistrationRow,
  EventRegistrationUpdate,
} from "@/types/models";

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
  const { data, error } = await supabase.rpc("event_registration_count", {
    p_event_id: eventId,
  });

  if (error) throw error;
  return data ?? 0;
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

export async function finalizePaidEventTicket(
  supabase: DbClient,
  purchaseId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("finalize_paid_event_ticket", {
    p_purchase_id: purchaseId,
  });

  if (error) throw error;
  return data;
}
