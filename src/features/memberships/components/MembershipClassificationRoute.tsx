import { redirect } from "next/navigation";

import { MembershipClassification } from "./MembershipClassification";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import { hasActiveOrPendingMembership } from "@/features/memberships/lib/policy";

export async function MembershipClassificationRoute({
  returnTo,
}: {
  returnTo?: string;
}) {
  const user = await requireAuth(
    withReturnTo("/portal/membership/join", returnTo),
  );

  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);

  // Both cases land on /portal/membership, which explains why in one place.
  if (
    isMembershipTermClosed(termEndsAt) ||
    hasActiveOrPendingMembership(user, termEndsAt)
  ) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  return (
    <MembershipClassification
      initialUserType={user.user_type}
      returnTo={returnTo}
    />
  );
}
