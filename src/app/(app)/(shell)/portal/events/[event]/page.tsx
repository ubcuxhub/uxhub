import { cache } from "react";
import type { Metadata } from "next";
import { EventDescription } from "@/components/shared/EventDescription";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EventPageHeader } from "@/features/events/components/EventPageHeader";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import { fetchUserEventTicket } from "@/lib/supabase-helpers/event-tickets";
import { pacificDate } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import { fetchEventPeopleSections, fetchEventSponsors } from "@/lib/supabase-helpers/event-people";
import { EventPeopleCard } from "@/features/events/components/EventPeopleCard";
import { EventsBackPill } from "@/features/events/components/EventsBackPill";
import { displayUrl, EventHeaderDetails, type EventWebsite } from "@/features/events/components/EventHeaderDetails";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { DRAFT_EVENTS_NOTE, draftRegistrationBlocks, isDraftEvent } from "@/features/events/lib/event-visibility";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";
import { TeamCard, TeamInviteNotice } from "@/features/events/components/teams/TeamCard";
import { EventDraftSections } from "@/features/events/components/EventDraftSections";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { eventWorkingDocument } from "@/features/admin/lib/event-presentation";
import { loadTeamCard } from "@/features/events/lib/team-card-data";
import { getHeadersOrigin } from "@/lib/http/request-origin";
import { adminIsUnpublishedEvent } from "@/lib/supabase-helpers/admin-server";
import { EventRemovedStatus } from "@/features/events/components/EventPageStatus";

interface PortalEventPageProps {
  params: Promise<{ event: string }>;
  /** `join` is a team invite code, from an invite link (`/join/<code>`). */
  searchParams: Promise<{ join?: string | string[] }>;
}

/**
 * The event, read once per request by both the metadata and the page. No
 * status filter: RLS returns drafts to admins and managers only, who can open
 * one to test it (docs/event-states.md, "Drafts for admins").
 */
const loadEvent = cache(async (slug: string) => fetchEventBySlug(await createClient(), slug));

/** The event's name in the tab, for whoever RLS lets read it. */
export async function generateMetadata({ params }: Pick<PortalEventPageProps, "params">): Promise<Metadata> {
  const event = await loadEvent((await params).event);
  // A published event stays unnamed while student events are off, as the page 404s.
  if (!event || (!FLAGS.studentEvents && event.status !== "draft")) return { title: "Events · UBC UX Hub" };
  return { title: `${event.name} · UBC UX Hub` };
}

export default async function PortalEventPage({
  params,
  searchParams,
}: PortalEventPageProps) {
  const [{ event: slug }, { join }] = await Promise.all([params, searchParams]);
  const user = await requireAuth();
  const supabase = await createClient();
  const event = await loadEvent(slug);

  if (!event) {
    // A published event moved back to draft is hidden by RLS, so ask with the
    // service role (a yes/no only) to say it was removed rather than missing.
    if (await adminIsUnpublishedEvent(slug)) return <EventRemovedStatus />;
    notFound();
  }
  if (!FLAGS.studentEvents && event.status !== "draft") notFound();
  
  const joinCode = typeof join === "string" ? join : null;
  const origin = getHeadersOrigin(await headers()) ?? "";
  const [participant, peopleSections, sponsors, states] = await Promise.all([
    fetchEventParticipantContent(supabase, event.id),
    // Admins switch these sections off per event, as the public event page does.
    event.mentors_enabled ? fetchEventPeopleSections(supabase, event.id) : [],
    event.sponsors_enabled ? fetchEventSponsors(supabase, event.id) : [],
    loadEventStates(supabase, user.id, [event]),
  ]);
  const state = states[event.id];
  const badge = eventBadgeFor(state);
  const canceled = state.kind === "canceled";
  // They keep a canceled event's ticket, and a past one's.
  const hasTicket = "ticketId" in state && state.ticketId !== null;
  const going = state.kind === "reg-going" || state.kind === "reg-checked-in";

  // Each read once, and only when something here uses it. The links (RLS
  // returns the ones this viewer may see) feed the agenda items, Open Slack
  // and the panel's participant packages; the ticket, the panel's code.
  const [links, ticket, teams] = await Promise.all([
    going || participant.agenda.some((day) => day.items.length > 0) ? fetchEventLinks(supabase, event.id) : [],
    hasTicket ? fetchUserEventTicket(supabase, event.id, user.id) : null,
    event.teams_enabled ? loadTeamCard({ event, userId: user.id, hasTicket, joinCode, origin }) : null,
  ]);

  // Open Slack is for students going (checked in or not), and only when the
  // event has a Slack workspace link.
  const slackUrl = going
    ? links.find((link) => link.type === "slack_workspace")?.url ?? null
    : null;
  const website = publicMarketingDestination(event);
  const hostedPath = `/events/${event.slug}`;
  const websiteRow: EventWebsite | null =
    website.kind === "external"
      ? { kind: "external", href: website.url, display: displayUrl(website.url) }
      : website.kind === "hosted"
        ? { kind: "hosted", href: hostedPath, display: displayUrl(`${originHost(origin)}${hostedPath}`) }
        : null;

  return (
    <PageContainer className="space-y-6">
      {/* Back to the timeline view the student came from (Upcoming or Past). */}
      <EventsBackPill />
      {/* RLS returns a draft to admins and managers only, so only they see this. */}
      {isDraftEvent(event) && (
        <Alert>This is a draft event. {DRAFT_EVENTS_NOTE}</Alert>
      )}
      
      {/* Header: the banner (shared with the builder's preview, so what an
          admin crops is what students see), then the title and badge, the
          facts and the description (Figma 1.3). */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <EventPageHeader
          className="rounded-t-xl"
          imageSrc={event.header_image_url ? resolveImagePreviewSrc(event.header_image_url) : undefined}
          colour={event.header_colour ?? undefined}
          iconSrc={event.image_url ? resolveImagePreviewSrc(event.image_url) : undefined}
          // An image icon stands in without an event image, so the header keeps its shape.
          iconPlaceholder
        />
        <div className="px-8 pb-8">
          <div className="flex flex-col items-start gap-5 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-start gap-3">
              <h1 className="text-h2">{event.name}</h1>
              {badge && <StatusBadge {...badge} />}
            </div>
            {slackUrl && (
              <Button asChild variant="secondary" className="px-5">
                <a href={slackUrl} target="_blank" rel="noopener noreferrer">
                  {/* The Slack mark keeps its brand colours, so it's an image, not a Lucide icon. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/slack.svg" width={16} height={16} alt="" />
                  Open Slack
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            )}
          </div>

          <div className="pt-6">
            <EventHeaderDetails
              startsAt={event.starts_at}
              endsAt={event.ends_at}
              location={participant.location}
              fallbackBuilding={event.location_building}
              website={websiteRow}
            />
          </div>

          <div className="max-w-180 pt-6 text-body">
            <EventDescription rich={event.description_rich} text={event.description} />
          </div>
        </div>
      </section>

      {/* Registration and Your team side by side (Figma 4640:2): equal columns,
          stretched to the same height. Registration takes the full width when
          there's no team card, and they stack below `xl`, where a column would
          be too narrow for the ticket. */}
      <div className={teams?.show && !canceled ? "grid grid-cols-1 gap-6 xl:grid-cols-2" : undefined}>

        {/* Registration and applications: one card whose layout follows the student's state. */}
        <RegistrationPanel event={{ ...event, slug }} user={user} state={state} links={links} ticket={ticket} unavailable={draftRegistrationBlocks(event, FLAGS.studentEvents)} />
        {/* A canceled event's teams are locked for good, so the card goes. */}
        {teams?.show && !canceled ? <TeamCard {...teams.props} /> : null}
      </div>
      {teams && !teams.show && teams.inviteError && !canceled ? (
        <TeamInviteNotice inviteError={teams.inviteError} />
      ) : null}
      {event.status === "draft" && <EventDraftSections event={event} />}


      <EventAgendaTable
        eventName={event.name}
        agenda={participant.agenda}
        today={pacificDate(new Date().toISOString())}
        itemLinks={Object.fromEntries(
          links.flatMap((link) => (link.agenda_item_id ? [[link.agenda_item_id, link.url]] : []))
        )}
      />

      {/* One card per people section (Judges, Mentors, Speakers, Panelists or a
          custom title), in the builder's order. */}
      {!eventWorkingDocument(event) &&
        peopleSections.map((section) => (
          <EventPeopleCard
            key={section.id}
            type="people"
            title={section.title}
            people={section.people}
          />
        ))}
      {!eventWorkingDocument(event) && <EventPeopleCard type="sponsors" people={sponsors} />}
    </PageContainer>
  );
}

/** "ubcuxhub.ca" from the request origin, or nothing when it's unknown. */
function originHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}
