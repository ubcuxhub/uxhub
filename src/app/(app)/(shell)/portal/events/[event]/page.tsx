import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { Calendar, MapPin } from "lucide-react";
import { formatEventDate, formatEventTime } from "@/lib/date";

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

  const startTime = formatEventTime(event.start_time);
  const endTime = formatEventTime(event.end_time);
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-4">
      <h1 className="text-h1">{event.name}</h1>

      <div className="flex items-start gap-3 text-small">
        <Calendar className="mt-0.5 text-muted-foreground" />
        <div>
          <p className="font-medium">
            {formatEventDate(event.start_date) ?? "TBD"}
            {event.end_date && event.end_date !== event.start_date
              ? ` – ${formatEventDate(event.end_date)}`
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
        <MapPin className="mt-0.5 text-muted-foreground" />
        <p className="font-medium">{location || "TBD"}</p>
      </div>

      <Button asChild>
        <Link href={`/events/${event.slug}`}>View full event details</Link>
      </Button>
    </PageContainer>
  );
}
