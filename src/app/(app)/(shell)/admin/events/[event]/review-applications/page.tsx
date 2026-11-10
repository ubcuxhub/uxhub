import { notFound } from "next/navigation";

import { ReviewApplicationsClient } from "@/features/admin/components/ReviewApplicationsClient";
import { withReviewState } from "@/features/admin/lib/application-review";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { formatEventDate, formatEventDateLabel } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/supabase/models";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchEventApplicationSummaries } from "@/lib/supabase-helpers/event-applications";

interface ReviewApplicationsPageProps {
  params: Promise<{ event: string }>;
}

/** "Applications closed Nov 3 · Event Jan 9–10". */
function describeSchedule(
  event: Pick<EventRow, "registration_closes_at" | "starts_at" | "ends_at">
): string {
  const closes = formatEventDate(event.registration_closes_at, {
    month: "short",
    year: undefined,
  });
  const closed =
    event.registration_closes_at !== null &&
    Date.parse(event.registration_closes_at) <= Date.now();
  return [
    closes ? `Applications ${closed ? "closed" : "close"} ${closes}` : null,
    event.starts_at
      ? `Event ${formatEventDateLabel(event.starts_at, event.ends_at)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function ReviewApplicationsPage({
  params,
}: ReviewApplicationsPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(
    supabase,
    eventParam,
    "/review-applications"
  );
  const [event, summaries] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchEventApplicationSummaries(supabase, eventId),
  ]);

  if (!event) notFound();

  const subtitle = describeSchedule(event);

  return (
    <ReviewApplicationsClient
      eventId={eventId}
      eventName={event.name}
      subtitle={subtitle}
      capacity={event.max_capacity}
      applications={summaries.map((summary) => withReviewState(summary))}
    />
  );
}
