import { fetchEventHistoryInfo } from "@/lib/supabase-helpers/event-mutations";
import { fetchEventContent } from "@/lib/supabase-helpers/event-content";
import { fetchEventTeamSettingsInfo } from "@/lib/supabase-helpers/teams";
import { fetchEventApplicationSettings } from "@/lib/supabase-helpers/event-application-settings";
import { fetchEventDateLocationSettings, fetchEventRegistrationSettings } from "@/lib/supabase-helpers/event-date-locations";
import { fetchEventWithDraft } from "@/lib/supabase-helpers/event-drafts";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";
import { EventCreateModify } from "@/features/admin/components/EventCreateModify";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import { fetchCheckInSessions } from "@/lib/supabase-helpers/check-ins";
import { fetchEventPricingLocked } from "@/lib/supabase-helpers/events";
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
 * own beside the list (outside `(browse)`) and the manager (outside
 * `(manager)`), reached from "Edit event" in the drawer or the manager. Its
 * header starts with "Back to event", a plain link to the manager's Overview
 * that the builder's unsaved-changes guard asks before following. The manager,
 * not the builder, wears the drawer's top bar and morphs with the drawer.
 */
export default async function EditEventPage({ params }: EditEventPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(supabase, eventParam, "/edit");
  // One round trip: none of these reads depends on another, and the event and
  // its working document come from the same row.
  const [
    loaded,
    checkInSessions,
    applicationQuestions,
    mentors,
    sponsors,
    mentorOptions,
    sponsorOptions,
    pricingLocked,
    dateLocation,
    registrationInfo,
    applicationSettings,
    teamInfo,
    content,
    historyInfo,
  ] = await Promise.all([
    fetchEventWithDraft(supabase, eventId),
    fetchCheckInSessions(supabase, eventId),
    fetchApplicationQuestions(supabase, eventId),
    fetchEventMentors(supabase, eventId),
    fetchEventSponsors(supabase, eventId),
    searchMentors(supabase, ""),
    searchSponsors(supabase, ""),
    fetchEventPricingLocked(supabase, eventId),
    fetchEventDateLocationSettings(supabase, eventId),
    fetchEventRegistrationSettings(supabase, eventId),
    fetchEventApplicationSettings(supabase, eventId),
    fetchEventTeamSettingsInfo(supabase, eventId),
    fetchEventContent(supabase, eventId),
    fetchEventHistoryInfo(supabase, eventId),
  ]);

  if (!loaded) notFound();
  const { event, draft: workingDraft } = loaded;

  return (
    <PageContainer className="max-w-none min-[821px]:px-12 lg:px-12">
      <EventCreateModify
        historyInfo={historyInfo}
        initialContent={content}
        teamInfo={teamInfo}
        initialApplicationSettings={applicationSettings}
        initialDateLocation={dateLocation}
        registrationInfo={registrationInfo}
        pricingLocked={pricingLocked}
        eventId={eventId}
        initialDraft={workingDraft}
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
