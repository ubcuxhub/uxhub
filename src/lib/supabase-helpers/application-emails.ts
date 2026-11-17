import type { DbClient } from "./types";

/**
 * Application emails (supabase/README.md, "Application emails"): the
 * service-role functions behind `/api/internal/application-emails`. The
 * delivery table lives in the private `application_emails` schema, so these
 * RPCs are the only way in, and only for the service role.
 */

export type ApplicationEmailKind =
  | "accepted"
  | "waitlisted"
  | "rejected"
  | "offer_reminder";

const KINDS: readonly string[] = [
  "accepted",
  "waitlisted",
  "rejected",
  "offer_reminder",
] satisfies ApplicationEmailKind[];

export interface ClaimedApplicationEmail {
  deliveryId: string;
  kind: ApplicationEmailKind;
  /** Including this one; the fifth failure is the last. */
  attempts: number;
  applicationId: string;
  eventId: string;
  email: string;
  firstName: string;
  eventName: string;
  eventSlug: string;
  offerExpiresAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

/** The most attempts an email gets before it is left unsent. */
export const MAX_APPLICATION_EMAIL_ATTEMPTS = 5;

/**
 * Claims up to `limit` due emails. `eventIds` narrows the claim to those
 * events (tests use it so a seeded database's own due emails stay put).
 */
export async function claimApplicationEmails(
  serviceClient: DbClient,
  limit: number,
  eventIds?: string[]
): Promise<ClaimedApplicationEmail[]> {
  const { data, error } = await serviceClient.rpc("claim_application_emails", {
    p_limit: limit,
    ...(eventIds ? { p_event_ids: eventIds } : {}),
  });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (!KINDS.includes(row.kind)) return [];
    return [
      {
        deliveryId: row.delivery_id,
        kind: row.kind as ApplicationEmailKind,
        attempts: row.attempts,
        applicationId: row.application_id,
        eventId: row.event_id,
        email: row.email,
        firstName: row.first_name,
        eventName: row.event_name,
        eventSlug: row.event_slug,
        offerExpiresAt: row.offer_expires_at ?? null,
        startsAt: row.starts_at ?? null,
        endsAt: row.ends_at ?? null,
      },
    ];
  });
}

/**
 * Records a claimed email as sent, or as failed with a short code (never a
 * message), which hands it back for the next run until its fifth attempt.
 * Returns the attempts so far, or null when it was no longer claimed.
 */
export async function completeApplicationEmail(
  serviceClient: DbClient,
  deliveryId: string,
  outcome: { sent: true } | { sent: false; errorCode: string }
): Promise<number | null> {
  const { data, error } = await serviceClient.rpc("complete_application_email", {
    p_delivery_id: deliveryId,
    p_sent: outcome.sent,
    ...(outcome.sent ? {} : { p_error_code: outcome.errorCode }),
  });
  if (error) throw error;
  return data ?? null;
}

/**
 * Hands back claims the route never tried, without counting an attempt.
 * Returns how many it released.
 */
export async function releaseApplicationEmails(
  serviceClient: DbClient,
  deliveryIds: string[],
  reason: string
): Promise<number> {
  if (deliveryIds.length === 0) return 0;
  const { data, error } = await serviceClient.rpc("release_application_emails", {
    p_delivery_ids: deliveryIds,
    p_reason: reason,
  });
  if (error) throw error;
  return data ?? 0;
}
