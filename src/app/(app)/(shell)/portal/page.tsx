import { PageContainer } from "@/components/shared/PageContainer";
import { requireAuth } from "@/lib/auth/guards";
import {
  getEffectiveMembershipExpiry,
  hasActiveMembership,
} from "@/lib/membership";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import {
  MembershipCard,
  MembershipCardEmptyState,
} from "@/features/memberships/components/MembershipCard";
import { formatUserName } from "@/lib/user-name";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";

export default async function PortalHome() {
  const user = await requireAuth();
  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);
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

      {membershipType ? (
        <MembershipCard
          cardholder={formatUserName(user) || firstName}
          expiresAt={getEffectiveMembershipExpiry(user, termEndsAt)}
          membershipType={membershipType}
        />
      ) : (
        canJoin && !isMember && <MembershipCardEmptyState />
      )}
    </PageContainer>
  );
}
