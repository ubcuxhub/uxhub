import { notFound } from "next/navigation";

import {
  ApplicationReviewClient,
  type AdminApplicationRegistration,
  type AdminApplicationResponse,
} from "@/features/admin/components/ApplicationReviewClient";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationResponsesForRegistration } from "@/lib/supabase-helpers/event-applications";
import { fetchEventRegistrationById } from "@/lib/supabase-helpers/event-registrations";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";

interface ApplicationReviewPageProps {
  params: Promise<{ event: string; registrationId: string }>;
}

export default async function ApplicationReviewPage({
  params,
}: ApplicationReviewPageProps) {
  await requireAdmin();
  const { event: eventId, registrationId } = await params;
  const supabase = await createClient();
  const registration = await fetchEventRegistrationById(
    supabase,
    registrationId
  );

  if (!registration || registration.event_id !== eventId) notFound();

  const [userInfo, event, responses] = await Promise.all([
    fetchUserInfoContactById(supabase, registration.user_id),
    fetchEventById(supabase, registration.event_id),
    fetchApplicationResponsesForRegistration(supabase, registrationId),
  ]);

  if (!userInfo || !event) notFound();

  return (
    <ApplicationReviewClient
      registration={registration as AdminApplicationRegistration}
      userInfo={userInfo}
      event={event}
      responses={responses as AdminApplicationResponse[]}
    />
  );
}
