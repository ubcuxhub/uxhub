import { notFound } from "next/navigation";

import {
  ApplicationReviewClient,
  type AdminApplicationResponse,
} from "@/features/admin/components/ApplicationReviewClient";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createApplicationFileUrl } from "@/lib/supabase-helpers/application-files";
import {
  fetchApplicationResponses,
  fetchEventApplicationById,
  isSubmittedApplication,
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

  // Drafts are the applicant's alone; RLS hides them from admins as well.
  if (
    !application ||
    application.event_id !== eventId ||
    !isSubmittedApplication(application)
  ) {
    notFound();
  }

  const [userInfo, event, responses, ticket] = await Promise.all([
    fetchUserInfoContactById(supabase, application.user_id),
    fetchEventById(supabase, application.event_id),
    fetchApplicationResponses(supabase, applicationId),
    fetchUserEventTicket(supabase, application.event_id, application.user_id),
  ]);

  if (!userInfo || !event) notFound();

  const fileUrls = Object.fromEntries(
    (
      await Promise.all(
        responses
          .filter(
            (response) =>
              response.event_application_questions?.response_type ===
                "file_upload" && response.response
          )
          .map(async (response) => [
            response.id,
            await createApplicationFileUrl(supabase, response.response),
          ])
      )
    ).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );

  return (
    <ApplicationReviewClient
      application={application}
      hasTicket={Boolean(ticket)}
      userInfo={userInfo}
      event={event}
      responses={responses as AdminApplicationResponse[]}
      fileUrls={fileUrls}
    />
  );
}
