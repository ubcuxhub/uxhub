import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { CheckInScanner } from "@/features/admin/components/CheckInScanner";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { QrCode } from "@/features/events/components/QrCode";
import { requireAdmin } from "@/lib/auth/guards";
import { getHeadersOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCheckInAttendees,
  fetchCheckInSessions,
} from "@/lib/supabase-helpers/check-ins";
import { fetchEventById } from "@/lib/supabase-helpers/events";

interface CheckInScanPageProps {
  params: Promise<{ event: string }>;
}

export default async function CheckInScanPage({ params }: CheckInScanPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(
    supabase,
    eventParam,
    "/check-in/scan"
  );
  const [event, sessions, attendees, requestHeaders] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchCheckInSessions(supabase, eventId),
    fetchCheckInAttendees(supabase, eventId),
    headers(),
  ]);

  if (!event) notFound();

  // Drawn here so the `qrcode` package stays off the client.
  const origin = getHeadersOrigin(requestHeaders);
  const phoneLink = origin ? (
    <QrCode
      value={`${origin}/admin/events/${eventId}/check-in/scan`}
      label="Link to this scanner"
    />
  ) : null;

  return (
    <CheckInScanner
      eventId={eventId}
      eventName={event.name}
      sessions={sessions}
      initialAttendees={attendees}
      phoneLink={phoneLink}
    />
  );
}
