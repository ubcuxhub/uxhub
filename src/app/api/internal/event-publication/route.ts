import { flush } from "@sentry/nextjs";
import { verifyCronSignature } from "@/lib/http/cron-signature";
import { adminGetPublicationHealth } from "@/lib/supabase-helpers/admin-server";
import { errorFields, log } from "@/lib/log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signed = verifyCronSignature(request, {
    secret: process.env.EVENT_PUBLICATION_HEALTH_SECRET,
    purpose: "event-publication",
    headerPrefix: "x-publication",
  });
  if (!signed) return new Response(null, { status: 401 });

  try {
    // Allow for the publisher's minute rounding and a five-minute grace period.
    const before = new Date(Date.now() - 5 * 60_000).toISOString();
    const health = await adminGetPublicationHealth(before);
    // A blocked draft waits for the hourly recovery run, so report it even
    // before it is overdue. Ids only (log fields are scalars, so joined):
    // event copy never reaches the logs.
    if (health.overdue > 0 || health.blocked > 0) {
      log.error("event.publication_overdue", {
        count: health.overdue,
        blocked: health.blocked,
        eventIds: health.blockedEventIds.join(","),
        before,
      });
      await flush(2000);
    }
    return Response.json({ overdue: health.overdue, blocked: health.blocked });
  } catch (error) {
    log.error("event.publication_health_check_failed", errorFields(error));
    await flush(2000);
    return new Response(null, { status: 503 });
  }
}
