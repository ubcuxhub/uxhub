import Image from "next/image";
import { EventDescription } from "@/components/shared/EventDescription";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EventLocation } from "@/components/shared/EventLocation";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import { Calendar, Link2, MapPin } from "lucide-react";
import { formatEventDate, formatEventTime, pacificDate } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import { fetchEventPeopleSections, fetchEventSponsors } from "@/lib/supabase-helpers/event-people";
import { EventPeopleCard } from "@/features/events/components/EventPeopleCard";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { DRAFT_EVENTS_NOTE, isDraftEvent } from "@/features/events/lib/event-visibility";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";
import { DraftTestRegistration } from "@/features/events/components/DraftTestRegistration";
import { TeamCard, TeamInviteNotice } from "@/features/events/components/teams/TeamCard";
import { EventDraftSections } from "@/features/events/components/EventDraftSections";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { eventWorkingDocument } from "@/features/admin/lib/event-presentation";
import { loadTeamCard, type TeamCardData } from "@/features/events/lib/team-card-data";
import { getHeadersOrigin } from "@/lib/http/request-origin";
import { adminIsUnpublishedEvent } from "@/lib/supabase-helpers/admin-server";
import { EventRemovedStatus } from "@/features/events/components/EventPageStatus";

interface PortalEventPageProps {
  params: Promise<{ event: string }>;
  /** `join` is a team invite code, from an invite link (`/join/<code>`). */
  searchParams: Promise<{ join?: string | string[] }>;
}

export default async function PortalEventPage({
  params,
  searchParams,
}: PortalEventPageProps) {
  const [{ event: slug }, { join }] = await Promise.all([params, searchParams]);
  const user = await requireAuth();
  const supabase = await createClient();
  // No status filter: RLS returns drafts to admins and managers only, who
  // can open one to test it (docs/event-states.md, "Drafts for admins").
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) {
    // A published event moved back to draft is hidden by RLS, so ask with the
    // service role (a yes/no only) to say it was removed rather than missing.
    if (await adminIsUnpublishedEvent(slug)) return <EventRemovedStatus />;
    notFound();
  }
  if (!FLAGS.studentEvents && event.status !== "draft") notFound();
  
  const joinCode = typeof join === "string" ? join : null;
  const origin = getHeadersOrigin(await headers()) ?? "";
  const [participant, peopleSections, sponsors, states, teams] = await Promise.all([
    // Agenda item links come from event_links, which RLS filters by each
    // link's visibility. Only fetched when there's an agenda to put them on.
    fetchEventParticipantContent(supabase, event.id).then(async (content) => ({
      ...content,
      links: content.agenda.some((day) => day.items.length > 0) ? await fetchEventLinks(supabase, event.id) : [],
    })),
    // Admins switch these sections off per event, as the public event page
    // does. `mentors_enabled` covers every people section but Sponsors.
    event.mentors_enabled ? fetchEventPeopleSections(supabase, event.id) : [],
    event.sponsors_enabled ? fetchEventSponsors(supabase, event.id) : [],
    loadEventStates(supabase, user.id, [event]),
    event.teams_enabled
      ? loadTeamCard({ supabase, event, userId: user.id, joinCode, origin })
      : null as TeamCardData | null,
  ]);
  const badge = eventBadgeFor(states[event.id]);
  const canceled = states[event.id].kind === "canceled";
  // Ticket holders only. A canceled event's teams are locked for good, so the card goes.
  const showTeam = Boolean(teams?.show) && !canceled;
  // Open Slack is for students going (checked in or not), and only when the
  // event has a Slack workspace link. RLS returns the links this viewer may see.
  const going = states[event.id].kind === "reg-going" || states[event.id].kind === "reg-checked-in";
  const slackUrl = going
    ? (await fetchEventLinks(supabase, event.id)).find((link) => link.type === "slack_workspace")?.url ?? null
    : null;
  const website = publicMarketingDestination(event);

  const startTime = formatEventTime(event.starts_at);
  const endTime = formatEventTime(event.ends_at);
  const endsOnLaterDay =
    event.ends_at && pacificDate(event.ends_at) !== pacificDate(event.starts_at);

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-6">
      {/* RLS returns a draft to admins and managers only, so only they see this. */}
      {isDraftEvent(event) && (
        <Alert>This is a draft event. {DRAFT_EVENTS_NOTE}</Alert>
      )}
      
      <div className="border-border-subtle rounded-md border">
        <div className="w-full h-51 bg-muted relative rounded-t-md" style={{ backgroundColor: event.header_colour || undefined }}>
          {event.header_image_url && <Image src={resolveImagePreviewSrc(event.header_image_url)} alt="" fill className="object-cover" unoptimized />}
          {/* cover image placeholder */}
          {event.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImagePreviewSrc(event.image_url)}
              alt=""
              className="size-24 rounded-xl object-cover absolute -bottom-4 left-12"
            />
          )}          
        </div>
        <div className="px-6 pb-6">
          <div className="my-10 flex flex-col gap-6">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-start gap-3">
                <h1 className="text-h1">{event.name}</h1>
                {badge && <StatusBadge {...badge} size="large" />}
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

            <hr className="w-full border-border-subtle" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
              <div className="flex items-start gap-3 text-small">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md border-[0.8px] text-muted-foreground"><Calendar className="size-5" aria-hidden /></span>
                <div className="flex min-w-0 flex-col gap-1 break-words">
                  <p className="font-medium">
                    {formatEventDate(event.starts_at, { year: "numeric", month: "short" }) ?? "TBD"}
                    {endsOnLaterDay
                      ? ` – ${formatEventDate(event.ends_at, { year: "numeric", month: "short" }) ?? "TBD"}`
                      : ""}
                  </p>
                  {startTime && (
                    <p className="text-muted-foreground">
                      {startTime}
                      {endTime ? ` – ${endTime}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 text-small">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md border-[0.8px] text-muted-foreground"><MapPin className="size-5" aria-hidden /></span>
                <div className="flex min-w-0 flex-col gap-1 break-words">
                  {participant.location ? <EventLocation location={participant.location} /> : <p>{event.location_building || "TBD"}</p>}
                </div>
              </div>

              {website.kind !== "none" && (
                <div className="flex items-start gap-3 text-small">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md border-[0.8px] text-muted-foreground"><Link2 className="size-5" aria-hidden /></span>
                  <div className="flex min-w-0 flex-col gap-1 break-words">
                    <p className="font-medium">Event details</p>
                    {website.kind === "external" ? (
                      <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground">
                        {event.name} website
                      </a>
                    ) : (
                      <Link href={`/events/${event.slug}`} className="text-muted-foreground">
                        {event.name} website
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <EventDescription rich={event.description_rich} text={event.description} />
        </div>
      </div>

      {/* Registration and Your team side by side (Figma 4640:2): equal columns,
          stretched to the same height. Registration takes the full width when
          there's no team card, and they stack below `xl`, where a column would
          be too narrow for the ticket. */}
      <div className={showTeam ? "grid grid-cols-1 gap-6 xl:grid-cols-2" : undefined}>
        {/* Registration and applications: one card whose layout follows the student's state. */}
        {event.status === "draft" ? <DraftTestRegistration event={{ ...event, slug }} user={user} state={states[event.id]} checkoutAvailable={FLAGS.studentEvents} /> : <RegistrationPanel event={{ ...event, slug }} user={user} state={states[event.id]} />}
        {showTeam && teams?.show ? <TeamCard {...teams.props} /> : null}
      </div>
      {event.status === "draft" && <EventDraftSections event={event} />}
      {teams && !teams.show && teams.inviteError && !canceled ? (
        <TeamInviteNotice inviteError={teams.inviteError} />
      ) : null}


      <EventAgendaTable
        eventName={event.name}
        agenda={participant.agenda}
        today={pacificDate(new Date().toISOString())}
        itemLinks={Object.fromEntries(
          participant.links.flatMap((link) => (link.agenda_item_id ? [[link.agenda_item_id, link.url]] : []))
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
