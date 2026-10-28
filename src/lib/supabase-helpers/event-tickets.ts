import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventTicketRow } from "@/lib/supabase/models";

export interface EventSeatCount {
  tickets: number;
  heldOffers: number;
  /** Seats nobody holds: capacity minus tickets and unexpired offers. */
  seatsLeft: number;
}

export async function fetchEventTicketByPurchaseId(
  supabase: DbClient,
  purchaseId: string
): Promise<EventTicketRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventTickets)
    .select("*")
    .eq("purchase_id", purchaseId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchUserEventTicket(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<EventTicketRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventTickets)
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Seat counts for many events in one round trip, through `event_seat_counts`,
 * which counts every ticket and held offer but only for events the caller can
 * see. An event the caller cannot see is absent from the result.
 */
export async function fetchEventSeatCounts(
  supabase: DbClient,
  eventIds: string[]
): Promise<Map<string, EventSeatCount>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("event_seat_counts", {
    p_event_ids: eventIds,
  });

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      row.event_id,
      {
        tickets: Number(row.tickets),
        heldOffers: Number(row.held_offers),
        seatsLeft: Number(row.seats_left),
      },
    ])
  );
}

/**
 * Issues one ticket through `reserve_event_ticket`, or returns why it cannot
 * (see `formatReservationFailure`). Service role only. A retried purchase gets
 * its existing ticket back.
 */
export async function reserveEventTicket(
  supabase: DbClient,
  input: { eventId: string; userId: string; purchaseId?: string | null }
): Promise<{ ticketId: string | null; failureReason: string | null }> {
  const { data, error } = await supabase.rpc("reserve_event_ticket", {
    p_event_id: input.eventId,
    p_user_id: input.userId,
    p_purchase_id: input.purchaseId ?? undefined,
  });

  if (error) throw error;

  const row = data?.[0];
  return {
    ticketId: row?.ticket_id ?? null,
    failureReason: row?.failure_reason ?? null,
  };
}

/**
 * Frees the ticket reserved for a purchase that did not complete. A no-op for
 * a completed purchase, a ticket with a check-in, or no ticket. Service role
 * only.
 */
export async function releaseEventTicket(
  supabase: DbClient,
  purchaseId: string
): Promise<void> {
  const { error } = await supabase.rpc("release_event_ticket", {
    p_purchase_id: purchaseId,
  });

  if (error) throw error;
}
