import Link from "next/link";
import { notFound } from "next/navigation";
import { FlowLink } from "@/components/shared/FlowLink";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { Calendar, MapPin } from "lucide-react";
import { formatEventDate, formatEventTime, pacificDate } from "@/lib/date";

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

  const startTime = formatEventTime(event.starts_at);
  const endTime = formatEventTime(event.ends_at);
  const endsOnLaterDay =
    event.ends_at && pacificDate(event.ends_at) !== pacificDate(event.starts_at);
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-4">
      {event.status !== "active" && (
        <Alert>Draft: only admins can see this.</Alert>
      )}

      <h1 className="text-h1">{event.name}</h1>

      <div className="flex items-start gap-3 text-small">
        <Calendar className="mt-0.5 text-muted-foreground" />
        <div>
          <p className="font-medium">
            {formatEventDate(event.starts_at) ?? "TBD"}
            {endsOnLaterDay ? ` – ${formatEventDate(event.ends_at)}` : ""}
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
        <MapPin className="mt-0.5 text-muted-foreground" />
        <p className="font-medium">{location || "TBD"}</p>
      </div>

      {/* The public page shows active events only. */}
      <Button asChild>
        {event.status === "active" ? (
          <Link href={`/events/${event.slug}`}>View full event details</Link>
        ) : (
          <FlowLink href={`/portal/events/${event.slug}/checkout`}>Register</FlowLink>
        )}
      </Button>
    </PageContainer>
  );
}
