import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";
import { RecordPage } from "@/components/shared/RecordDrawer";
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
 * The event builder: every section of the event, for editing. A page of its
 * own beside the list (outside `(browse)`), reached from the overview
 * drawer's "Edit event". It wears the drawer's top bar: close returns to the
 * list, collapse to the list with this event's drawer open. `RecordPage` makes
 * it the drawer's panel grown to full size, so expand and collapse morph.
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
    <RecordPage
      listHref="/admin/events"
      listLabel="Back to Manage Events"
      recordHref={`/admin/events/${eventId}`}
    >
      <PageContainer>
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
    </RecordPage>
  );
}
