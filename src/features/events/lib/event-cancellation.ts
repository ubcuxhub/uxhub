import type { EventRow } from "@/lib/supabase/models";

import { hasEventEnded } from "./event-rules";

/** The fields that say whether an event reads as canceled right now. */
export type CancelableEvent = Pick<EventRow, "canceled_at" | "starts_at" | "ends_at">;

/**
 * Whether students see an event as canceled: it was canceled
 * (`cancel_admin_event`) and hasn't ended. Once it ends it reads as any past
 * event (docs/event-states.md, "Canceled events"). An event without an end
 * ends when it starts, and is still running at that instant, as in
 * `eventStateFor`.
 */
export function isCanceledEvent(event: CancelableEvent, now: Date = new Date()): boolean {
  return !!event.canceled_at && !hasEventEnded(event, now);
}
