import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { Calendar, MapPin } from "lucide-react";

function formatDate(date: string | null) {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string | null) {
  if (!time) return null;
  const value = time.includes("T") ? time : `1970-01-01T${time}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return time;
  return parsed.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface PortalEventPageProps {
  params: Promise<{ event: string }>;
}

export default async function PortalEventPage({
  params,
}: PortalEventPageProps) {
  const { event: slug } = await params;
  await requireAuth();
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug);

  if (!event) {
    notFound();
  }

  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  return (
    <PageContainer backHref="/portal/events" backLabel="Back to Events" className="space-y-4">
      <h1 className="text-3xl font-semibold">{event.name}</h1>

      <div className="flex items-start gap-3 text-sm">
        <Calendar className="mt-0.5 text-muted-foreground" />
        <div>
          <p className="font-medium">
            {formatDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date
              ? ` – ${formatDate(event.end_date)}`
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

      <div className="flex items-start gap-3 text-sm">
        <MapPin className="mt-0.5 text-muted-foreground" />
        <p className="font-medium">{location || "TBD"}</p>
      </div>

      <Button asChild>
        <Link href={`/events/${event.slug}`}>View full event details</Link>
      </Button>
    </PageContainer>
  );
}
