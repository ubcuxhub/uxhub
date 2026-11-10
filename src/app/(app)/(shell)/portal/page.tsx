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
import {
  MembershipCard,
  MembershipCardEmptyState,
} from "@/features/memberships/components/MembershipCard";
import { DiscountCodes } from "@/features/memberships/components/DiscountCodes";
import { formatUserName } from "@/lib/user-name";
import { createClient } from "@/lib/supabase/server";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";

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

  // Only a current member needs the tier row; the empty state says the same
  // thing whatever they would have bought.
  const membershipType =
    isMember && user.membership_type_id
      ? await fetchMembershipTypeById(supabase, user.membership_type_id)
      : null;

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="mb-2 text-h1 tracking-tight">Hey, {firstName}!</h1>
        <p className="text-muted-foreground">Welcome to the UX Hub portal.</p>
      </div>

      {shouldShowProfileNudge(user, nudgeDismissed) && <ProfileNudge />}

      {membershipType ? (
        <MembershipCard
          cardholder={formatUserName(user) || firstName}
          expiresAt={getEffectiveMembershipExpiry(user, termEndsAt)}
          membershipType={membershipType}
        />
      ) : (
        canJoin && !isMember && <MembershipCardEmptyState />
      )}

      {isMember && <DiscountCodes />}
    </PageContainer>
  );
}
