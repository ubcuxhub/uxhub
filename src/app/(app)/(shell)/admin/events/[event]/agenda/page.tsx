import { notFound } from "next/navigation";
import { StaffAgenda } from "@/features/admin/components/StaffAgenda";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { selectedAgendaDayId } from "@/features/admin/lib/staff-agenda";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchStaffAgenda } from "@/lib/supabase-helpers/event-agenda-notes";
import { fetchStaffVolunteerSchedule } from "@/lib/supabase-helpers/event-content";
import { fetchEventById } from "@/lib/supabase-helpers/events";

export default async function AgendaPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams?: Promise<{ day?: string }> }) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const query = await searchParams;
  const client = await createClient();
  const eventId = await resolveAdminEventId(client, eventParam, `/agenda${query?.day ? `?day=${encodeURIComponent(query.day)}` : ""}`);
  const [event, days, schedule] = await Promise.all([
    fetchEventById(client, eventId), fetchStaffAgenda(client, eventId), fetchStaffVolunteerSchedule(client, eventId),
  ]);
  if (!event) notFound();
  return <StaffAgenda eventId={eventId} eventName={event.name} days={days} initialDayId={selectedAgendaDayId(days, query?.day, new Date())} volunteerUrl={schedule?.url ?? null} />;
}
