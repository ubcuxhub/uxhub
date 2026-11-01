import { notFound } from "next/navigation";

import { CheckInManager } from "@/features/admin/components/CheckInManager";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCheckInAttendees,
  fetchCheckInSessions,
  fetchCheckInStatuses,
} from "@/lib/supabase-helpers/check-ins";
import { fetchEventById } from "@/lib/supabase-helpers/events";

interface CheckInPageProps {
  params: Promise<{ event: string }>;
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(
    supabase,
    eventParam,
    "/check-in"
  );
  const [event, sessions, attendees, statuses] = await Promise.all([
    fetchEventById(supabase, eventId),
    fetchCheckInSessions(supabase, eventId),
    fetchCheckInAttendees(supabase, eventId),
    fetchCheckInStatuses(supabase, eventId),
  ]);

  if (!event) notFound();

  return (
    <CheckInManager
      eventId={eventId}
      event={event}
      initialCheckInSessions={sessions}
      initialAttendees={attendees}
      initialCheckInStatuses={Array.from(statuses.entries())}
    />
  );
}
