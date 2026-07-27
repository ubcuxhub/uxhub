import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchCheckInSessions } from "@/lib/supabase-helpers/check-ins";
import { fetchEventById } from "@/lib/supabase-helpers/events";

interface EventViewProps {
  params: Promise<{ event: string }>;
}

export default async function EventView({ params }: EventViewProps) {
  await requireAdmin();
  const { event: eventId } = await params;
  const supabase = await createClient();
  const [event, checkInSessions, applicationQuestions] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchCheckInSessions(supabase, eventId),
    fetchApplicationQuestions(supabase, eventId),
  ]);

  if (!event) notFound();

  return (
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify
        eventId={eventId}
        initialEvent={event}
        initialCheckInSessions={checkInSessions}
        initialApplicationQuestions={applicationQuestions}
      />
    </PageContainer>
  );
}
