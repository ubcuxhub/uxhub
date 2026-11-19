import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Hubbo } from "@/components/shared/Hubbo";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { parseInviteCode } from "@/features/events/lib/teams";
import { requireAuth } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchTeamByInviteCode } from "@/lib/supabase-helpers/teams";

interface JoinTeamPageProps {
  params: Promise<{ code: string }>;
}

/**
 * A team invite link, `/join/<code>`. Signing in comes first (the `(app)`
 * layout sends a signed-out visitor to log in and back here), then this sends
 * the student to the team's event page, which opens "Join [team]?" (7.5).
 *
 * The team is looked up with the service role, as students can't read a team
 * they aren't on; the event, with the student's own client, so a draft stays
 * hidden from them.
 */
export default async function JoinTeamPage({ params }: JoinTeamPageProps) {
  if (!FLAGS.studentEvents) notFound();

  const [{ code }] = await Promise.all([params, requireAuth()]);
  const inviteCode = parseInviteCode(code);
  const team = inviteCode ? await fetchTeamByInviteCode(supabaseAdmin, inviteCode) : null;
  const event = team ? await fetchEventById(await createClient(), team.event_id) : null;

  if (team && event?.teams_enabled) {
    redirect(`/portal/events/${event.slug}?join=${encodeURIComponent(team.invite_code)}`);
  }

  return (
    <PageContainer>
      <EmptyState
        size="page"
        titleAs="h2"
        media={<Hubbo emotion="thinking" size="card" />}
        title="This invite link doesn't work"
        description="The team may have been deleted. Ask your teammate for a new link."
        actions={
          <Button asChild size="sm">
            <Link href="/portal/events">Go to events</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
