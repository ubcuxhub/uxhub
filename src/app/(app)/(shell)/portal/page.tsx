import Link from "next/link";
import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { LINKTREE_URL } from "@/lib/constants";
import { FLAGS } from "@/lib/flags";
import { hasActiveMembership } from "@/lib/membership";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  UserRoundPlus,
} from "lucide-react";

function BecomeMemberBanner() {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-lg border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <UserRoundPlus className="text-primary" />
        </div>
        <div>
          <h3 className="text-subheading">Become a UX Hub member</h3>
          <p className="text-small text-muted-foreground">
            Unlock member pricing on events and exclusive perks.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <FlowLink href="/portal/membership/join">
          Become a member
          <ArrowRight />
        </FlowLink>
      </Button>
    </div>
  );
}

export default async function PortalHome() {
  const user = await requireAuth();
  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);
  const firstName = user.first_name || user.email.split("@")[0] || "there";
  const isMember = hasActiveMembership(user, termEndsAt);
  // Nothing to sell once the term has ended, so the prompt would lead nowhere.
  const canJoin = !isMembershipTermClosed(termEndsAt);

  return (
    <PageContainer>
      {!isMember && canJoin && <BecomeMemberBanner />}
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">
          Hey, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          Welcome to the UBC UX Hub portal.
        </p>
      </div>
      {FLAGS.studentEvents ? (
        <Button asChild variant="outline">
          <Link href="/portal/events">
            <CalendarDays />
            View your events
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline">
          <a href={LINKTREE_URL} target="_blank" rel="noopener noreferrer">
            <CalendarDays />
            See our upcoming events
            <ArrowUpRight />
          </a>
        </Button>
      )}
    </PageContainer>
  );
}
