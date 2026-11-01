import { notFound } from "next/navigation";

import {
  ApplicationReviewClient,
  type AdminApplicationResponse,
} from "@/features/admin/components/ApplicationReviewClient";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchApplicationResponses,
  fetchEventApplicationById,
} from "@/lib/supabase-helpers/event-applications";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";
import { isUuid } from "@/lib/uuid";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; applicationId: string }>;
}

export default async function ApplicationReviewPage({
  params,
}: ApplicationReviewPageProps) {
  await requireAdmin();
  const { event: eventParam, applicationId } = await params;
  // `applicationId` is queried against a uuid column too, so a malformed one
  // is a 404 rather than a thrown Postgres error.
  if (!isUuid(applicationId)) notFound();
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(
    supabase,
    eventParam,
    `/review-applications/${applicationId}`
  );
  const application = await fetchEventApplicationById(supabase, applicationId);

  if (!application || application.event_id !== eventId) notFound();

  const [userInfo, event, responses, ticket] = await Promise.all([
    fetchUserInfoContactById(supabase, application.user_id),
    fetchEventById(supabase, application.event_id),
    fetchApplicationResponses(supabase, applicationId),
    fetchUserEventTicket(supabase, application.event_id, application.user_id),
  ]);

  if (!userInfo || !event) notFound();

  return (
    <ApplicationReviewClient
      application={application}
      hasTicket={Boolean(ticket)}
      userInfo={userInfo}
      event={event}
      responses={responses as AdminApplicationResponse[]}
    />
  );
}
