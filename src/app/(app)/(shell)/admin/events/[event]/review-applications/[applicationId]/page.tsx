import { notFound } from "next/navigation";

import {
  ApplicationReviewClient,
  type AdminApplicationResponse,
} from "@/features/admin/components/ApplicationReviewClient";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchApplicationResponses,
  fetchEventApplicationById,
} from "@/lib/supabase-helpers/event-applications";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; applicationId: string }>;
}

export default async function ApplicationReviewPage({
  params,
}: ApplicationReviewPageProps) {
  await requireAdmin();
  const { event: eventId, applicationId } = await params;
  const supabase = await createClient();
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
