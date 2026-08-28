import Link from "next/link";
import { FlowLink } from "@/components/shared/FlowLink";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

function BecomeMemberBanner() {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-lg border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="text-primary" />
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
  const firstName = user.name?.split(" ")[0] || user.email.split("@")[0] || "there";
  const isMember =
    Boolean(user.membership_type_id) &&
    (!user.membership_expires_at ||
      new Date(user.membership_expires_at) > new Date());

  return (
    <PageContainer>
      {!isMember && <BecomeMemberBanner />}
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">
          Hey, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          Welcome to the UBC UX Hub portal.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/portal/events">
          <CalendarDays />
          View your events
        </Link>
      </Button>
    </PageContainer>
  );
}
