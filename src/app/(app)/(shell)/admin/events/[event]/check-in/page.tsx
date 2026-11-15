import { CheckInManager } from "@/features/admin/components/CheckInManager";
import { resolveAdminEvent } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCheckInAttendees,
  fetchCheckInSessions,
  fetchCheckInStatuses,
} from "@/lib/supabase-helpers/check-ins";

interface CheckInPageProps {
  params: Promise<{ event: string }>;
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const event = await resolveAdminEvent(supabase, eventParam, "/check-in");
  const eventId = event.id;
  const [sessions, attendees, statuses] = await Promise.all([
    fetchCheckInSessions(supabase, eventId),
    fetchCheckInAttendees(supabase, eventId),
    fetchCheckInStatuses(supabase, eventId),
  ]);

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
