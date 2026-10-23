import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { fetchEventAgenda } from "@/lib/supabase-helpers/event-agenda";
import { Calendar, Link2, MapPin } from "lucide-react";
import { formatEventDate, formatEventTime } from "@/lib/date";
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
  const event = await fetchEventBySlug(supabase, slug, { status: "active" });
  
  if (!event) {
    notFound();
  }
  
  const agenda = await fetchEventAgenda(supabase, event.id);
  // Admins switch these sections off per event, as the public event page does.
  const mentors = event.mentors_enabled ? await fetchEventMentors(supabase, event.id) : [];
  const sponsors = event.sponsors_enabled ? await fetchEventSponsors(supabase, event.id) : [];
  const startTime = formatEventTime(event.start_time);
  const endTime = formatEventTime(event.end_time);

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-4">
      <div className="border-border-subtle rounded-md border">
        <div className="w-full h-51 bg-brand-blue-200 relative rounded-t-md">
          {/* cover image placeholder */}
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImagePreviewSrc(event.image_url)}
              alt=""
              className="size-24 rounded-xl object-cover absolute -bottom-4 left-12"
            />
          ) : (
            <div>
            </div>
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
                    {formatEventDate(event.start_date, { year: "numeric", month: "short" }) ?? "TBD"}
                    {event.end_date && event.end_date !== event.start_date
                      ? ` – ${formatEventDate(event.end_date, { year: "numeric", month: "short" }) ?? "TBD"}`
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
          <p>{event.description}</p>
        </div>
      </div>

      <div className="border-border-subtle rounded-md border flex flex-col gap-6 p-6">
        <h3 className="text-h3">Registration</h3>
        
        <hr className="w-full border-border-subtle" />
        
        <div className="flex flex-col gap-2">
          <p className="text-subheading">You're RSVP'd to {event.name}!</p>
          <p>Don't forget to read the participant package before the event.</p>
        </div>
      </div>

      <EventAgendaTable eventName={event.name} agenda={agenda} />

      <EventPeopleCard type="mentors" people={mentors} />
      <EventPeopleCard type="sponsors" people={sponsors} />
    </PageContainer>
  );
}
