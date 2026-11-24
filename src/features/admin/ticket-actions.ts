"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  regenerateEventTicketToken,
  voidEventTicket,
  type VoidEventTicketRefusal,
} from "@/lib/supabase-helpers/event-tickets";
import { isUuid } from "@/lib/uuid";

export type TicketAdminActionResult = { ok: true } | { ok: false; error: string };

const VOID_TICKET_REFUSALS: Record<VoidEventTicketRefusal, string> = {
  TICKET_NOT_FOUND: "This ticket no longer exists.",
  TICKET_CHECKED_IN:
    "This ticket has been checked in. Undo its check-ins first, then void it.",
  TICKET_PAID:
    "This ticket was paid for and hasn't been fully refunded. Refund it in Square instead; the ticket is removed once the refund completes.",
};

/**
 * Gives a ticket a new QR code. The holder keeps the ticket and sees the new
 * code on their event page; the old code, screenshots included, scans as not
 * a UX Hub ticket.
 */
export async function regenerateTicketQrAction(
  ticketId: string
): Promise<TicketAdminActionResult> {
  await requireAdmin();
  if (typeof ticketId !== "string" || !isUuid(ticketId)) {
    return { ok: false, error: VOID_TICKET_REFUSALS.TICKET_NOT_FOUND };
  }

  const regenerated = await regenerateEventTicketToken(supabaseAdmin, ticketId);
  if (!regenerated) {
    log.warn("ticket.regenerate_refused", { ticketId, reason: "TICKET_NOT_FOUND" });
    return { ok: false, error: VOID_TICKET_REFUSALS.TICKET_NOT_FOUND };
  }

  log.info("ticket.qr_regenerated", { ticketId });
  return { ok: true };
}

/**
 * Takes a ticket back, freeing its seat and its holder's team spot. Refused
 * for a checked-in ticket and for a paid one not yet refunded in full.
 */
export async function voidTicketAction(
  ticketId: string
): Promise<TicketAdminActionResult> {
  await requireAdmin();
  if (typeof ticketId !== "string" || !isUuid(ticketId)) {
    return { ok: false, error: VOID_TICKET_REFUSALS.TICKET_NOT_FOUND };
  }

  const refusal = await voidEventTicket(supabaseAdmin, ticketId);
  if (refusal) {
    log.warn("ticket.void_refused", { ticketId, reason: refusal });
    return { ok: false, error: VOID_TICKET_REFUSALS[refusal] };
  }

  log.info("ticket.voided", { ticketId });
  return { ok: true };
}
