import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin/components/EventCreateModify";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchCheckInSessions } from "@/lib/supabase-helpers/check-ins";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import {
  fetchEventMentors,
  fetchEventSponsors,
  searchMentors,
  searchSponsors,
} from "@/lib/supabase-helpers/event-people";

interface EditEventPageProps {
  params: Promise<{ event: string }>;
}

/**
 * The event builder. `/admin/events/<id>` is the event's overview (and its
 * record drawer); this page holds every section of the event for editing.
 * Never a drawer: nothing under `@flow` matches it.
 */
export default async function EditEventPage({ params }: EditEventPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(supabase, eventParam, "/edit");
  const [
    event,
    checkInSessions,
    applicationQuestions,
    mentors,
    sponsors,
    mentorOptions,
    sponsorOptions,
  ] =
    await Promise.all([
      fetchEventById(supabase, eventId),
      fetchCheckInSessions(supabase, eventId),
      fetchApplicationQuestions(supabase, eventId),
      fetchEventMentors(supabase, eventId),
      fetchEventSponsors(supabase, eventId),
      searchMentors(supabase, ""),
      searchSponsors(supabase, ""),
    ]);

  if (!event) notFound();

  return (
    <PageContainer backHref="/admin/events" backLabel="Back to Events">
      <EventCreateModify
        eventId={eventId}
        initialEvent={event}
        initialCheckInSessions={checkInSessions}
        initialApplicationQuestions={applicationQuestions}
        initialMentors={mentors}
        initialSponsors={sponsors}
        mentorOptions={mentorOptions}
        sponsorOptions={sponsorOptions}
      />
    </PageContainer>
  );
}
