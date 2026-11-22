import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shared/PageContainer";
import { EventTeamsView } from "@/features/admin/components/teams/EventTeamsView";
import { resolveAdminEventId } from "@/features/admin/lib/resolve-event-param";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEventTeamsOverview } from "@/lib/supabase-helpers/event-teams";

/**
 * The event manager's Teams tab (`/admin/events/<id>/teams`): the event's
 * teams and their members. The tab shows only for an event with teams; the
 * view says so itself when they're off.
 */
export default async function EventTeamsPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  await requireAdmin();
  const { event: eventParam } = await params;
  const supabase = await createClient();
  const eventId = await resolveAdminEventId(supabase, eventParam, "/teams");
  const overview = await fetchEventTeamsOverview(supabase, eventId);
  if (!overview) notFound();

  return (
    <PageContainer>
      <EventTeamsView overview={overview} />
    </PageContainer>
  );
}
