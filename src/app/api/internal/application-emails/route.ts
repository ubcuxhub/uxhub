import { createHmac, timingSafeEqual } from "node:crypto";
import { flush } from "@sentry/nextjs";

import { EmailSendError, sendEmail } from "@/lib/email/client";
import { portalEventUrl, renderApplicationEmail } from "@/lib/email/application-templates";
import { FLAGS } from "@/lib/flags";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  claimApplicationEmails,
  completeApplicationEmail,
  MAX_APPLICATION_EMAIL_ATTEMPTS,
  releaseApplicationEmails,
  type ClaimedApplicationEmail,
} from "@/lib/supabase-helpers/application-emails";

export const runtime = "nodejs";
// A full batch is paced under Resend's per-second limit (~15 seconds).
export const maxDuration = 60;

/** The most emails one run claims. */
const BATCH_SIZE = 25;
/** Resend allows a few requests a second; stay under it. */
const SEND_INTERVAL_MS = 600;
/** Resend errors that mean "stop for now", not "this email is bad". */
const STOP_CODES = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function verified(request: Request) {
  const secret = process.env.APPLICATION_EMAILS_SECRET;
  const timestamp = request.headers.get("x-application-emails-timestamp") ?? "";
  const signature = request.headers.get("x-application-emails-signature") ?? "";
  if (!secret || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)
    || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`application-emails:${timestamp}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Sends the application emails that are due (supabase/README.md,
 * "Application emails"). Only the production pg_cron job calls this, signed
 * with `APPLICATION_EMAILS_SECRET`; it does nothing while student events are
 * off. Logs carry ids and codes only, never an address or a name.
 */
export async function POST(request: Request) {
  if (!verified(request)) return new Response(null, { status: 401 });
  if (!FLAGS.studentEvents) return Response.json({ skipped: "flag" });

  const origin = new URL(request.url).origin;
  let claims: ClaimedApplicationEmail[];
  try {
    claims = await claimApplicationEmails(supabaseAdmin, BATCH_SIZE);
  } catch (error) {
    log.error("application.email_claim_failed", errorFields(error));
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
    const ids = { deliveryId: claim.deliveryId, applicationId: claim.applicationId, kind: claim.kind };
    if (index > 0) await wait(SEND_INTERVAL_MS);

    let outcome: "sent" | "stop" | { code: string };
    try {
      const { subject, html } = renderApplicationEmail({
        kind: claim.kind,
        firstName: claim.firstName,
        eventName: claim.eventName,
        eventUrl: portalEventUrl(origin, claim.eventSlug),
        offerExpiresAt: claim.offerExpiresAt,
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
      const rest = claims.slice(index).map((item) => item.deliveryId);
      log.warn("application.email_paused", { reason: stopped, released: rest.length });
      try {
        released = await releaseApplicationEmails(supabaseAdmin, rest, stopped ?? "STOPPED");
      } catch (error) {
        // The claims go stale and the next run after 15 minutes retries them.
        log.error("application.email_release_failed", errorFields(error));
        reported = true;
      }
      break;
    }

    try {
      if (outcome === "sent") {
        sent += 1;
        log.info("application.email_sent", ids);
        await completeApplicationEmail(supabaseAdmin, claim.deliveryId, { sent: true });
      } else {
        failed += 1;
        const attempts = await completeApplicationEmail(supabaseAdmin, claim.deliveryId, {
          sent: false,
          errorCode: outcome.code,
        });
        const exhausted = (attempts ?? claim.attempts) >= MAX_APPLICATION_EMAIL_ATTEMPTS;
        log.warn("application.email_failed", { ...ids, code: outcome.code, attempts: attempts ?? claim.attempts });
        // Out of attempts: nobody will retry it, so someone should look.
        if (exhausted) {
          log.error("application.email_abandoned", { ...ids, code: outcome.code });
          reported = true;
        }
      }
    } catch (error) {
      // A sent email whose record failed is retried once its claim goes stale
      // (15 minutes), so it may arrive twice; that beats never.
      log.error("application.email_record_failed", { ...ids, ...errorFields(error) });
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
