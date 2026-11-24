import { flush } from "@sentry/nextjs";

import { EmailSendError, sendEmail } from "@/lib/email/client";
import { FLAGS } from "@/lib/flags";
import { verifyCronSignature } from "@/lib/http/cron-signature";
import { errorFields, log } from "@/lib/log";

/** Resend allows a few requests a second; stay under it. */
const SEND_INTERVAL_MS = 600;
/** Resend errors that mean "stop for now", not "this email is bad". */
const STOP_CODES = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DeliveryOutcome = { sent: true } | { sent: false; errorCode: string };

/** One kind of queued email: how to claim, render and settle it. */
export interface EmailDeliveryCron<Claim extends { email: string; attempts: number }> {
  /**
   * Signs the message (`<purpose>:<timestamp>`) and names the headers
   * (`x-<purpose>-timestamp`, `x-<purpose>-signature`).
   */
  purpose: string;
  /** Log event prefix, e.g. `event.reminder` for `event.reminder_sent`. */
  event: string;
  batchSize: number;
  maxAttempts: number;
  claim: (limit: number) => Promise<Claim[]>;
  /** The delivery row's id, which complete and release take. */
  idOf: (claim: Claim) => string;
  /** Ids and codes to log for the claim, never an address or a name. */
  logFields: (claim: Claim) => Record<string, string>;
  render: (claim: Claim, origin: string) => { subject: string; html: string };
  /** Records the outcome; returns the attempts so far when it knows them. */
  complete: (id: string, outcome: DeliveryOutcome) => Promise<number | null>;
  /** Hands claims back unsent; returns how many it released. */
  release: (ids: string[], reason: string) => Promise<number>;
}

/**
 * The shared body of the `/api/internal/*` email routes that pg_cron calls
 * (supabase/README.md). It checks the job's signature (signed with
 * `APPLICATION_EMAILS_SECRET`), does nothing while student events are off,
 * claims a batch and sends it paced under Resend's limit. A rate or quota
 * error, or no Resend key, releases the rest for the next run; any other
 * send error is recorded against that email, which the database retries
 * until `maxAttempts`.
 */
export async function runEmailDeliveryCron<Claim extends { email: string; attempts: number }>(
  request: Request,
  cron: EmailDeliveryCron<Claim>,
): Promise<Response> {
  const signed = verifyCronSignature(request, {
    secret: process.env.APPLICATION_EMAILS_SECRET,
    purpose: cron.purpose,
    headerPrefix: `x-${cron.purpose}`,
  });
  if (!signed) return new Response(null, { status: 401 });
  if (!FLAGS.studentEvents) return Response.json({ skipped: "flag" });

  const origin = new URL(request.url).origin;
  let claims: Claim[];
  try {
    claims = await cron.claim(cron.batchSize);
  } catch (error) {
    log.error(`${cron.event}_claim_failed`, errorFields(error));
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
    const id = cron.idOf(claim);
    const ids = cron.logFields(claim);
    if (index > 0) await wait(SEND_INTERVAL_MS);

    let outcome: "sent" | "stop" | { code: string };
    try {
      const { subject, html } = cron.render(claim, origin);
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
      const rest = claims.slice(index).map(cron.idOf);
      log.warn(`${cron.event}_paused`, { reason: stopped, released: rest.length });
      try {
        released = await cron.release(rest, stopped ?? "STOPPED");
      } catch (error) {
        // The claims go stale and the next run after 15 minutes retries them.
        log.error(`${cron.event}_release_failed`, errorFields(error));
        reported = true;
      }
      break;
    }

    try {
      if (outcome === "sent") {
        sent += 1;
        log.info(`${cron.event}_sent`, ids);
        await cron.complete(id, { sent: true });
      } else {
        failed += 1;
        const attempts =
          (await cron.complete(id, { sent: false, errorCode: outcome.code })) ?? claim.attempts;
        log.warn(`${cron.event}_failed`, { ...ids, code: outcome.code, attempts });
        // Out of attempts: nobody will retry it, so someone should look.
        if (attempts >= cron.maxAttempts) {
          log.error(`${cron.event}_abandoned`, { ...ids, code: outcome.code });
          reported = true;
        }
      }
    } catch (error) {
      // A sent email whose record failed is retried once its claim goes stale
      // (15 minutes), so it may arrive twice; that beats never.
      log.error(`${cron.event}_record_failed`, { ...ids, ...errorFields(error) });
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
