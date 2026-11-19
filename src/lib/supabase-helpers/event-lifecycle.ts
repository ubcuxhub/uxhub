import type { DbClient } from "./types";
import type { EventRow } from "@/lib/supabase/models";
import { eventPresentation } from "@/features/admin/lib/event-presentation";

/**
 * What reverting or canceling an event touches, for the admin dialogs
 * (`event_lifecycle_counts`, docs/event-states.md, "Unpublishing" and
 * "Canceled events"):
 * - `registered`: members with a ticket, a held offer or a payment in flight,
 *   which block a revert to Draft;
 * - `memberApplications`: members' draft, submitted and waitlisted
 *   applications, which lose access while the event is a draft;
 * - `paidTickets`: tickets bought with money not yet fully refunded, which
 *   staff refund in Square after a cancel.
 *
 * Service role only.
 */
export interface EventLifecycleCounts {
  registered: number;
  memberApplications: number;
  paidTickets: number;
}

export async function fetchEventLifecycleCounts(
  serviceClient: DbClient,
  eventId: string
): Promise<EventLifecycleCounts> {
  const { data, error } = await serviceClient.rpc("event_lifecycle_counts", { p_event_id: eventId });
  if (error) throw error;
  const row = data?.[0];
  return {
    registered: row?.registered ?? 0,
    memberApplications: row?.member_applications ?? 0,
    paidTickets: row?.paid_tickets ?? 0,
  };
}

/**
 * Cancels an active event that hasn't ended, for good (`cancel_admin_event`).
 * `operationId` makes a retry return the first result. A refusal carries the
 * hint `EVENT_CANCEL_REFUSED`. Service role only: call it from a server
 * action that has run `requireAdmin()`.
 */
export async function cancelEvent(
  serviceClient: DbClient,
  eventId: string,
  note: string | null,
  operationId: string
): Promise<EventRow> {
  const { data, error } = await serviceClient.rpc("cancel_admin_event", {
    p_event_id: eventId,
    p_note: note ?? "",
    p_operation_id: operationId,
  });
  if (error) throw error;
  return eventPresentation(data as unknown as EventRow);
}
