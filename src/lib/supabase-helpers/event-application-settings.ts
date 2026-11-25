import type { DbClient } from "./types";
import { TABLES } from "./tables";

/** Staff-only form configuration; not an applicant decision projection. */
export async function fetchEventApplicationSettings(client: DbClient, eventId: string) {
  const { data, error } = await client.from(TABLES.eventApplicationSettings).select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data;
}

/** The offer window an accept used: Pacific calendar days after its start, at a wall time. */
export interface OfferWindow {
  days: number;
  /** `HH:mm`, Pacific. */
  time: string;
}

/**
 * Remembers the event's latest offer, the next accept's default
 * (`defaultOfferDeadline`): its exact deadline and, when it has one, its
 * window. Touches only those columns, so the builder's timing settings stay
 * as they are. Service role only.
 */
export async function recordLastOffer(
  serviceClient: DbClient,
  eventId: string,
  offer: { expiresAt: string; window: OfferWindow | null }
) {
  const { error } = await serviceClient
    .from(TABLES.eventApplicationSettings)
    .upsert(
      {
        event_id: eventId,
        last_offer_expires_at: offer.expiresAt,
        ...(offer.window && { offer_window_days: offer.window.days, offer_deadline_time: offer.window.time }),
      },
      { onConflict: "event_id" }
    );
  if (error) throw error;
}
