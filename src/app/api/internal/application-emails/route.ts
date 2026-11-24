import { portalEventUrl, renderApplicationEmail } from "@/lib/email/application-templates";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  claimApplicationEmails,
  completeApplicationEmail,
  MAX_APPLICATION_EMAIL_ATTEMPTS,
  releaseApplicationEmails,
} from "@/lib/supabase-helpers/application-emails";

import { runEmailDeliveryCron } from "../email-delivery-cron";

export const runtime = "nodejs";
// A full batch is paced under Resend's per-second limit (~15 seconds).
export const maxDuration = 60;

/**
 * Sends the application emails that are due (supabase/README.md,
 * "Application emails"). Only the production pg_cron job calls this; see
 * `runEmailDeliveryCron` for the signature, flag and pacing.
 */
export function POST(request: Request) {
  return runEmailDeliveryCron(request, {
    purpose: "application-emails",
    event: "application.email",
    batchSize: 25,
    maxAttempts: MAX_APPLICATION_EMAIL_ATTEMPTS,
    claim: (limit) => claimApplicationEmails(supabaseAdmin, limit),
    idOf: (claim) => claim.deliveryId,
    logFields: (claim) => ({
      deliveryId: claim.deliveryId,
      applicationId: claim.applicationId,
      kind: claim.kind,
    }),
    render: (claim, origin) =>
      renderApplicationEmail({
        kind: claim.kind,
        firstName: claim.firstName,
        eventName: claim.eventName,
        eventUrl: portalEventUrl(origin, claim.eventSlug),
        offerExpiresAt: claim.offerExpiresAt,
      }),
    complete: (id, outcome) => completeApplicationEmail(supabaseAdmin, id, outcome),
    release: (ids, reason) => releaseApplicationEmails(supabaseAdmin, ids, reason),
  });
}
