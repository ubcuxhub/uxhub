import { headers } from "next/headers";

import { CheckInScanner } from "@/features/admin/components/CheckInScanner";
import { adminEventPath } from "@/features/admin/lib/admin-event-path";
import { resolveAdminEvent } from "@/features/admin/lib/resolve-event-param";
import { QrCode } from "@/features/events/components/QrCode";
import { requireAdmin } from "@/lib/auth/guards";
import { getHeadersOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCheckInAttendees,
  fetchCheckInSessions,
} from "@/lib/supabase-helpers/check-ins";

interface CheckInScanPageProps {
  params: Promise<{ event: string }>;
}

export default async function CheckInScanPage({ params }: CheckInScanPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const event = await resolveAdminEvent(supabase, eventParam, "/check-in/scan");
  const eventId = event.id;
  const eventPath = adminEventPath(event);
  const [sessions, attendees, requestHeaders] = await Promise.all([
    fetchCheckInSessions(supabase, eventId),
    fetchCheckInAttendees(supabase, eventId),
    headers(),
  ]);

  // Drawn here so the `qrcode` package stays off the client.
  const origin = getHeadersOrigin(requestHeaders);
  const phoneLink = origin ? (
    <QrCode
      token={`${origin}${eventPath}/check-in/scan`}
      label="Link to this scanner"
      className="mx-auto size-48 rounded-lg bg-white"
    />
  ) : null;

  return (
    <CheckInScanner
      eventId={eventId}
      eventPath={eventPath}
      eventName={event.name}
      sessions={sessions}
      initialAttendees={attendees}
      phoneLink={phoneLink}
    />
  );
}
