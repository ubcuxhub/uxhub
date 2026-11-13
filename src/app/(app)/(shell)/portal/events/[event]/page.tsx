import Image from "next/image";
import { EventDescription } from "@/components/shared/EventDescription";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchEventAgenda } from "@/lib/supabase-helpers/event-agenda";
import { Calendar, Link2, MapPin } from "lucide-react";
import { formatEventDate, formatEventTime, pacificDate } from "@/lib/date";
import { resolveImagePreviewSrc } from "@/lib/event-image";
import { fetchEventMentors, fetchEventSponsors } from "@/lib/supabase-helpers/event-people";
import { EventPeopleCard } from "@/features/events/components/EventPeopleCard";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";
import { TeamCard, TeamInviteNotice } from "@/features/events/components/teams/TeamCard";
import { loadTeamCard, type TeamCardData } from "@/features/events/lib/team-card-data";
import { getHeadersOrigin } from "@/lib/http/request-origin";

interface PortalEventPageProps {
  params: Promise<{ event: string }>;
  /** `join` is a team invite code, from an invite link (`/join/<code>`). */
  searchParams: Promise<{ join?: string | string[] }>;
}

export default async function PortalEventPage({
  params,
  searchParams,
}: PortalEventPageProps) {
  if (!FLAGS.studentEvents) notFound();

  const [{ event: slug }, { join }] = await Promise.all([params, searchParams]);
  const user = await requireAuth();
  const supabase = await createClient();
  // No status filter: RLS returns drafts to admins and managers only, who
  // can open one to test it (docs/event-states.md, "Drafts for admins").
  const event = await fetchEventBySlug(supabase, slug);
  
  if (!event) {
    notFound();
  }
  
  const joinCode = typeof join === "string" ? join : null;
  const origin = getHeadersOrigin(await headers()) ?? "";
  const [agenda, mentors, sponsors, states, teams] = await Promise.all([
    event.agenda_enabled ? fetchEventAgenda(supabase, event.id) : [],
    // Admins switch these sections off per event, as the public event page does.
    event.mentors_enabled ? fetchEventMentors(supabase, event.id) : [],
    event.sponsors_enabled ? fetchEventSponsors(supabase, event.id) : [],
    loadEventStates(supabase, user.id, [event]),
    event.teams_enabled
      ? loadTeamCard({ supabase, event, userId: user.id, joinCode, origin })
      : null as TeamCardData | null,
  ]);
  const badge = eventBadgeFor(states[event.id]);

  const startTime = formatEventTime(event.starts_at);
  const endTime = formatEventTime(event.ends_at);
  const endsOnLaterDay =
    event.ends_at && pacificDate(event.ends_at) !== pacificDate(event.starts_at);

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-4">
      {event.status !== "active" && (
        <Alert>Draft: only admins can see this.</Alert>
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
            <div className="flex flex-col items-start gap-3">
              <h1 className="text-h1">{event.name}</h1>
              {badge && <StatusBadge {...badge} size="large" />}
            </div>

            <hr className="w-full border-border-subtle" />

            <div className="flex flex-col sm:flex-row justify-between gap-4"> 
              <div className="flex items-center gap-3 text-small">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md border-[0.8px] text-muted-foreground"><Calendar className="size-5" aria-hidden /></span>
                <div className="flex flex-col gap-1">
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
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{event.location_building || "TBD"}</p>
                  <p className="text-muted-foreground">{event.location_room || ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-small">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md border-[0.8px] text-muted-foreground"><Link2 className="size-5" aria-hidden /></span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Event details</p>
                  {/* TODO: make this the actual event website - does this need a migration? */}
                  <Link href={`/events/${event.slug}`} className="text-muted-foreground">
                    {event.name} website
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <EventDescription rich={event.description_rich} text={event.description} />
        </div>
      </div>

      {/* Registration and applications: one card whose layout follows the student's state. */}
      <RegistrationPanel event={{ ...event, slug }} user={user} state={states[event.id]} />

      {/* Ticket holders only. Stacked under the registration panel for now;
          placing it beside the panel is a follow-up. */}
      {teams?.show ? <TeamCard {...teams.props} /> : null}
      {teams && !teams.show && teams.inviteError ? (
        <TeamInviteNotice inviteError={teams.inviteError} />
      ) : null}


      <EventAgendaTable eventName={event.name} agenda={agenda} />

      <EventPeopleCard type="mentors" people={mentors} />
      <EventPeopleCard type="sponsors" people={sponsors} />
    </PageContainer>
  );
}
