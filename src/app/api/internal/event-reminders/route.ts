import { portalEventUrl } from "@/lib/email/application-templates";
import { renderEventReminderEmail } from "@/lib/email/reminder-templates";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  claimEventReminders,
  completeEventReminder,
  MAX_EVENT_REMINDER_ATTEMPTS,
  releaseEventReminders,
} from "@/lib/supabase-helpers/event-reminders";

import { runEmailDeliveryCron } from "../email-delivery-cron";

export const runtime = "nodejs";
// A full batch is paced under Resend's per-second limit (~30 seconds).
export const maxDuration = 60;

/**
 * Sends the event reminders that are due (supabase/README.md, "Event reminder
 * emails"). Only the production pg_cron job calls this, signing with the
 * application emails secret over its own message, so a signature for one
 * route never opens the other. See `runEmailDeliveryCron`.
 */
export function POST(request: Request) {
  return runEmailDeliveryCron(request, {
    purpose: "event-reminders",
    event: "event.reminder",
    batchSize: 50,
    maxAttempts: MAX_EVENT_REMINDER_ATTEMPTS,
    claim: (limit) => claimEventReminders(supabaseAdmin, limit),
    idOf: (claim) => claim.sendId,
    logFields: (claim) => ({
      sendId: claim.sendId,
      ticketId: claim.ticketId,
      eventId: claim.eventId,
      kind: claim.kind,
    }),
    render: (claim, origin) =>
      renderEventReminderEmail({
        kind: claim.kind,
        firstName: claim.firstName,
        eventName: claim.eventName,
        eventUrl: portalEventUrl(origin, claim.eventSlug),
        startsAt: claim.startsAt,
        endsAt: claim.endsAt,
        location: claim.location,
      }),
    complete: (id, outcome) => completeEventReminder(supabaseAdmin, id, outcome),
    release: (ids, reason) => releaseEventReminders(supabaseAdmin, ids, reason),
  });
}
