import Link from "next/link";
import { notFound } from "next/navigation";
import { FlowLink } from "@/components/shared/FlowLink";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

interface PortalEventPageProps {
  params: Promise<{ event: string }>;
}

export default async function PortalEventPage({
  params,
}: PortalEventPageProps) {
  if (!FLAGS.studentEvents) notFound();

  const { event: slug } = await params;
  await requireAuth();
  const supabase = await createClient();
  // No status filter: RLS returns drafts to admins and managers only, who
  // can open one to test it (docs/event-states.md, "Drafts for admins").
  const event = await fetchEventBySlug(supabase, slug);
  
  if (!event) {
    notFound();
  }
  
  const [agenda, mentors, sponsors] = await Promise.all([
    fetchEventAgenda(supabase, event.id),
    // Admins switch these sections off per event, as the public event page does.
    event.mentors_enabled ? fetchEventMentors(supabase, event.id) : [],
    event.sponsors_enabled ? fetchEventSponsors(supabase, event.id) : [],
  ]);

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
        <div className="w-full h-51 bg-brand-blue-200 relative rounded-t-md">
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
            <h1 className="text-h1">{event.name}</h1>

            <hr className="w-full border-border-subtle" />

            <div className="flex flex-col sm:flex-row justify-between gap-4"> 
              <div className="flex items-center gap-3 text-small">
                <Calendar className="p-3 h-fit w-fit text-muted-foreground border-[0.8px] rounded-md" />
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
                <MapPin className="p-3 h-fit w-fit text-muted-foreground border-[0.8px] rounded-md" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{event.location_building || "TBD"}</p>
                  <p className="text-muted-foreground">{event.location_room || ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-small">
                <Link2 className="p-3 h-fit w-fit text-muted-foreground border-[0.8px] rounded-md"/>
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
          <p className="whitespace-pre-wrap">{event.description}</p>
          {/* The public page shows active events only. */}
          <Button asChild className="mt-6">
            {event.status === "active" ? (
              <Link href={`/events/${event.slug}`}>View full event details</Link>
            ) : (
              <FlowLink href={`/portal/events/${event.slug}/checkout`}>Register</FlowLink>
            )}
          </Button>
        </div>
      </div>

      
      <EventAgendaTable eventName={event.name} agenda={agenda} />

      <EventPeopleCard type="mentors" people={mentors} />
      <EventPeopleCard type="sponsors" people={sponsors} />
    </PageContainer>
  );
}