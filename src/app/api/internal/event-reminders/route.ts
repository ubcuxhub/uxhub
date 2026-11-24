import { createHmac, timingSafeEqual } from "node:crypto";
import { flush } from "@sentry/nextjs";

import { EmailSendError, sendEmail } from "@/lib/email/client";
import { portalEventUrl } from "@/lib/email/application-templates";
import { renderEventReminderEmail } from "@/lib/email/reminder-templates";
import { FLAGS } from "@/lib/flags";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  claimEventReminders,
  completeEventReminder,
  MAX_EVENT_REMINDER_ATTEMPTS,
  releaseEventReminders,
  type ClaimedEventReminder,
} from "@/lib/supabase-helpers/event-reminders";

export const runtime = "nodejs";
// A full batch is paced under Resend's per-second limit (~30 seconds).
export const maxDuration = 60;

/** The most reminders one run claims. */
const BATCH_SIZE = 50;
/** Resend allows a few requests a second; stay under it. */
const SEND_INTERVAL_MS = 600;
/** Resend errors that mean "stop for now", not "this email is bad". */
const STOP_CODES = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The pg_cron job signs with the application emails secret over its own
 * message, so a signature for one route never opens the other.
 */
function verified(request: Request) {
  const secret = process.env.APPLICATION_EMAILS_SECRET;
  const timestamp = request.headers.get("x-event-reminders-timestamp") ?? "";
  const signature = request.headers.get("x-event-reminders-signature") ?? "";
  if (!secret || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)
    || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`event-reminders:${timestamp}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Sends the event reminders that are due (supabase/README.md, "Event reminder
 * emails"). Only the production pg_cron job calls this, signed with
 * `APPLICATION_EMAILS_SECRET`; it does nothing while student events are off.
 * Logs carry ids and codes only, never an address or a name.
 */
export async function POST(request: Request) {
  if (!verified(request)) return new Response(null, { status: 401 });
  if (!FLAGS.studentEvents) return Response.json({ skipped: "flag" });

  const origin = new URL(request.url).origin;
  let claims: ClaimedEventReminder[];
  try {
    claims = await claimEventReminders(supabaseAdmin, BATCH_SIZE);
  } catch (error) {
    log.error("event.reminder_claim_failed", errorFields(error));
    await flush(2000);
    return new Response(null, { status: 503 });
  }

  let sent = 0;
  let failed = 0;
  let released = 0;
  let stopped: string | null = null;
  // Sentry gets log.error events; flush them before the function freezes.
  let reported = false;

  for (const [index, claim] of claims.entries()) {
    const ids = { sendId: claim.sendId, ticketId: claim.ticketId, eventId: claim.eventId, kind: claim.kind };
    if (index > 0) await wait(SEND_INTERVAL_MS);

    let outcome: "sent" | "stop" | { code: string };
    try {
      const { subject, html } = renderEventReminderEmail({
        kind: claim.kind,
        firstName: claim.firstName,
        eventName: claim.eventName,
        eventUrl: portalEventUrl(origin, claim.eventSlug),
        startsAt: claim.startsAt,
        endsAt: claim.endsAt,
        location: claim.location,
      });
      // false: no RESEND_API_KEY, so nothing can send this run.
      outcome = (await sendEmail({ html, subject, to: claim.email })) ? "sent" : "stop";
      if (outcome === "stop") stopped = "NOT_CONFIGURED";
    } catch (error) {
      const code = error instanceof EmailSendError ? error.code : "SEND_FAILED";
      if (STOP_CODES.has(code)) {
        outcome = "stop";
        stopped = code;
      } else {
        outcome = { code };
      }
    }

    if (outcome === "stop") {
      const rest = claims.slice(index).map((item) => item.sendId);
      log.warn("event.reminder_paused", { reason: stopped, released: rest.length });
      try {
        released = await releaseEventReminders(supabaseAdmin, rest, stopped ?? "STOPPED");
      } catch (error) {
        // The claims go stale and the next run after 15 minutes retries them.
        log.error("event.reminder_release_failed", errorFields(error));
        reported = true;
      }
      break;
    }

    try {
      if (outcome === "sent") {
        sent += 1;
        log.info("event.reminder_sent", ids);
        await completeEventReminder(supabaseAdmin, claim.sendId, { sent: true });
      } else {
        failed += 1;
        const attempts = await completeEventReminder(supabaseAdmin, claim.sendId, {
          sent: false,
          errorCode: outcome.code,
        });
        const exhausted = (attempts ?? claim.attempts) >= MAX_EVENT_REMINDER_ATTEMPTS;
        log.warn("event.reminder_failed", { ...ids, code: outcome.code, attempts: attempts ?? claim.attempts });
        // Out of attempts: nobody will retry it, so someone should look.
        if (exhausted) {
          log.error("event.reminder_abandoned", { ...ids, code: outcome.code });
          reported = true;
        }
      }
    } catch (error) {
      // A sent reminder whose record failed is retried once its claim goes
      // stale (15 minutes), so it may arrive twice; that beats never.
      log.error("event.reminder_record_failed", { ...ids, ...errorFields(error) });
      reported = true;
    }
  }

  if (reported) await flush(2000);
  return Response.json({
    claimed: claims.length,
    sent,
    failed,
    released,
    ...(stopped ? { stopped } : {}),
  });
}
