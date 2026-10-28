import { createHmac, timingSafeEqual } from "node:crypto";
import { flush } from "@sentry/nextjs";
import { adminFindOverduePublications } from "@/lib/supabase-helpers/admin-server";
import { errorFields, log } from "@/lib/log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.EVENT_PUBLICATION_HEALTH_SECRET;
  const timestamp = request.headers.get("x-publication-timestamp") ?? "";
  const signature = request.headers.get("x-publication-signature") ?? "";
  if (!secret || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)
    || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return new Response(null, { status: 401 });
  }
  const expected = createHmac("sha256", secret).update(`event-publication:${timestamp}`).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new Response(null, { status: 401 });
  }

  try {
    // Allow for the publisher's minute rounding and a five-minute grace period.
    const before = new Date(Date.now() - 5 * 60_000).toISOString();
    const count = await adminFindOverduePublications(before);
    if (count > 0) {
      log.error("event.publication_overdue", { count, before });
      await flush(2000);
    }
    return Response.json({ overdue: count });
  } catch (error) {
    log.error("event.publication_health_check_failed", errorFields(error));
    await flush(2000);
    return new Response(null, { status: 503 });
  }
}
