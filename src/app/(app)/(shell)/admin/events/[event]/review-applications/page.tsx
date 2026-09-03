import { notFound } from "next/navigation";

import { ReviewApplicationsClient } from "@/features/admin/components/ReviewApplicationsClient";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchEventApplicationsWithUserContacts } from "@/lib/supabase-helpers/event-applications";

interface ReviewApplicationsPageProps {
  params: Promise<{ event: string }>;
}

export default async function ReviewApplicationsPage({
  params,
}: ReviewApplicationsPageProps) {
  await requireAdmin();
  const { event: eventId } = await params;
  const supabase = await createClient();
  const [event, applications] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchEventApplicationsWithUserContacts(supabase, eventId),
  ]);

  if (!event) notFound();

  return (
    <ReviewApplicationsClient
      eventId={eventId}
      eventName={event.name}
      applications={applications}
    />
  );
}
