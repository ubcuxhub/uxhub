import { notFound } from "next/navigation";

import { CheckInManager } from "@/features/admin/components/CheckInManager";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAttendingRegistrations,
  fetchCheckInSessions,
  fetchCheckInStatuses,
} from "@/lib/supabase-helpers/check-ins";
import { fetchRegistrationsForEvent } from "@/lib/supabase-helpers/event-registrations";
import { fetchEventById } from "@/lib/supabase-helpers/events";

interface CheckInPageProps {
  params: Promise<{ event: string }>;
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  await requireAdmin();
  const { event: eventId } = await params;
  const supabase = await createClient();
  const [event, sessions, registrations, statuses, allRegistrations] =
    await Promise.all([
      fetchEventById(supabase, eventId),
      fetchCheckInSessions(supabase, eventId),
      fetchAttendingRegistrations(supabase, eventId),
      fetchCheckInStatuses(supabase, eventId),
      fetchRegistrationsForEvent(supabase, eventId),
    ]);

  if (!event) notFound();

  return (
    <CheckInManager
      eventId={eventId}
      event={event}
      initialCheckInSessions={sessions}
      initialAttendingRegistrations={registrations}
      initialCheckInStatuses={Array.from(statuses.entries())}
      initialAllRegistrations={allRegistrations}
    />
  );
}
