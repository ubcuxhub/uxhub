import "server-only";

import { EmailSendError, sendEmail } from "@/lib/email/client";
import { portalApplicationUrl, renderApplicationEmail } from "@/lib/email/application-templates";
import { errorFields, log } from "@/lib/log";
import { fetchUserEventApplication } from "@/lib/supabase-helpers/event-applications";
import type { DbClient } from "@/lib/supabase-helpers/types";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

export interface ApplicationReceivedEmailInput {
  /** The applicant's own client: the release date is read as they may see it. */
  supabase: DbClient;
  applicationId: string;
  event: Pick<EventRow, "id" | "name" | "slug">;
  user: Pick<UserInfoRow, "id" | "email" | "first_name">;
  /** The site origin the applicant submitted from, null when unknown. */
  origin: string | null;
}

/**
 * The "we received your application" email, sent once after the submit RPC
 * reports the draft-to-submitted transition. Best-effort and never throws:
 * the application is already submitted, and nothing retries this email.
 * Logs carry ids and codes only.
 */
export async function sendApplicationReceivedEmail({
  supabase,
  applicationId,
  event,
  user,
  origin,
}: ApplicationReceivedEmailInput): Promise<void> {
  try {
    if (!user.email || !origin || !event.slug) {
      log.warn("application.received_email_skipped", {
        applicationId,
        reason: !user.email ? "no_email" : !origin ? "no_origin" : "no_slug",
      });
      return;
    }

    const releaseAt = await fetchDecisionsReleaseAt(supabase, applicationId, event.id, user.id);
    const { subject, html } = renderApplicationEmail({
      kind: "received",
      firstName: user.first_name,
      eventName: event.name,
      eventUrl: portalApplicationUrl(origin, event.slug),
      offerExpiresAt: null,
      decisionsReleaseAt: releaseAt,
    });

    // false: no RESEND_API_KEY (local), which `sendEmail` already logs.
    if (await sendEmail({ html, subject, to: user.email })) {
      log.info("application.received_email_sent", { applicationId });
    }
  } catch (error) {
    log.warn("application.received_email_failed", {
      applicationId,
      ...(error instanceof EmailSendError ? { code: error.code } : {}),
      ...errorFields(error),
    });
  }
}

/**
 * The event's "Release decisions on", when it is still ahead. A failed read
 * only loses the date: the email still goes, with the undated copy.
 */
async function fetchDecisionsReleaseAt(
  supabase: DbClient,
  applicationId: string,
  eventId: string,
  userId: string
): Promise<string | null> {
  try {
    const application = await fetchUserEventApplication(supabase, eventId, userId);
    const releaseAt = application?.decisions_release_at ?? null;
    return releaseAt && Date.parse(releaseAt) > Date.now() ? releaseAt : null;
  } catch (error) {
    log.warn("application.received_email_release_read_failed", {
      applicationId,
      ...errorFields(error),
    });
    return null;
  }
}
