import { notFound } from "next/navigation";

import { ApplicationReviewClient } from "@/features/admin/components/ApplicationReviewClient";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchApplicationResponses,
  fetchEventApplicationById,
} from "@/lib/supabase-helpers/event-applications";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; applicationId: string }>;
}

export default async function ApplicationReviewPage({
  params,
}: ApplicationReviewPageProps) {
  const admin = await requireAdmin();
  const { event: eventId, applicationId } = await params;
  const supabase = await createClient();
  const application = await fetchEventApplicationById(supabase, applicationId);

  if (!application || application.event_id !== eventId) notFound();

  const [userInfo, reviewerInfo, event, responses] = await Promise.all([
    fetchUserInfoContactById(supabase, application.user_id),
    application.reviewer_id
      ? fetchUserInfoContactById(supabase, application.reviewer_id)
      : Promise.resolve(null),
    fetchEventById(supabase, application.event_id),
    fetchApplicationResponses(supabase, applicationId),
  ]);

  if (!userInfo || !event) notFound();

  return (
    <ApplicationReviewClient
      application={application}
      userInfo={userInfo}
      reviewerInfo={reviewerInfo}
      currentAdmin={{ id: admin.id, name: admin.name, email: admin.email }}
      event={event}
      responses={responses}
    />
  );
}
