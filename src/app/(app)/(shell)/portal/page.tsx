import { cookies } from "next/headers";

import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import { redirectToSetupIfNeeded } from "@/features/setup/server";
import { ProfileNudge } from "@/features/setup/components/ProfileNudge";
import {
  PROFILE_NUDGE_COOKIE,
  shouldShowProfileNudge,
} from "@/features/setup/lib/profile-nudge";
import {
  getEffectiveMembershipExpiry,
  hasActiveMembership,
} from "@/features/memberships/lib/expiry";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import { MembershipCard } from "@/features/memberships/components/MembershipCard";
import { MembershipJoinBanner } from "@/features/memberships/components/MembershipJoinBanner";
import { DiscountCodes } from "@/features/memberships/components/DiscountCodes";
import { FeaturedEventCard } from "@/features/events/components/FeaturedEventCard";
import { eventBadgeFor } from "@/features/events/lib/event-badge";
import { loadEventStates } from "@/features/events/lib/event-states";
import { FLAGS } from "@/lib/flags";
import { formatUserName } from "@/lib/user-name";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { fetchFeaturedEvent } from "@/lib/supabase-helpers/events";

export default async function PortalHome() {
  const user = await requireAuth();
  // New members land here after sign-in; send them through setup first.
  redirectToSetupIfNeeded(user, "/portal");
  const supabase = await createClient();
  const nudgeDismissed = (await cookies()).has(PROFILE_NUDGE_COOKIE);
  const termEndsAt = await getMembershipTermEndsAt();
  const firstName = user.first_name || user.email.split("@")[0] || "there";
  const isMember = hasActiveMembership(user, termEndsAt);
  // Nothing to sell once the term has ended, so the prompt would lead nowhere.
  const canJoin = !isMembershipTermClosed(termEndsAt);
  const now = new Date();

  // Only a current member needs the tier row; the banner says the same thing
  // whatever they would have bought.
  const [membershipType, featured] = await Promise.all([
    isMember && user.membership_type_id
      ? fetchMembershipTypeById(supabase, user.membership_type_id)
      : null,
    // Student events are unlaunched in production, so nothing is featured there.
    FLAGS.studentEvents ? fetchFeaturedEvent(supabase, now) : null,
  ]);
  const featuredState = featured
    ? (await loadEventStates(supabase, user.id, [featured], now))[featured.id]
    : null;

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">Hey, {firstName}!</h1>
        <p className="text-muted-foreground">Welcome to the UX Hub portal.</p>
      </div>

      {/* Optional, so it sits under the heading; a required banner would go first. */}
      {shouldShowProfileNudge(user, nudgeDismissed) && <ProfileNudge />}

      {canJoin && !isMember && <MembershipJoinBanner className="mb-8" />}

      {(featured || membershipType) && (
        // Featured left and the card right on desktop; the card first on phones.
        <div className="grid gap-8 lg:grid-cols-2">
          {membershipType && (
            <MembershipCard
            className="order-1"
            cardholder={formatUserName(user) || firstName}
            expiresAt={getEffectiveMembershipExpiry(user, termEndsAt)}
            membershipType={membershipType}
            />
          )}
          {featured && (
            <FeaturedEventCard
              className={cn(
                "order-2 w-full max-w-[490px]",
                // Side by side, it drops its fixed shape and stretches to the
                // row, so it matches the membership card, which grows taller
                // when its column is narrow.
                membershipType && "lg:aspect-auto",
              )}
              title={featured.name}
              href={`/portal/events/${featured.slug}`}
              colour={featured.event_colour}
              image={featured.header_image_url ?? featured.image_url}
              badge={featuredState ? eventBadgeFor(featuredState) : null}
            />
          )}
        </div>
      )}

      {isMember && <DiscountCodes />}
    </PageContainer>
  );
}
