import { redirect } from "next/navigation";

import { MembershipClassification } from "./MembershipClassification";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import {
  confirmedJoinPath,
  hasActiveOrPendingMembership,
} from "@/features/memberships/lib/policy";

/**
 * The join flow's first step, "What best describes you?". A member who
 * already answered it (in setup or an earlier join) goes straight to the
 * details for that type, which links back here with `change` to answer again.
 */
export async function MembershipClassificationRoute({
  returnTo,
  change = false,
}: {
  returnTo?: string;
  change?: boolean;
}) {
  const user = await requireAuth(
    withReturnTo("/portal/membership/join", returnTo),
  );

  const termEndsAt = await getMembershipTermEndsAt();

  // Both cases land on /portal/membership, which explains why in one place.
  if (
    isMembershipTermClosed(termEndsAt) ||
    hasActiveOrPendingMembership(user, termEndsAt)
  ) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  // Keeps `returnTo` as the question's own Next would.
  const confirmed = confirmedJoinPath(user, change);
  if (confirmed) redirect(withReturnTo(confirmed, returnTo ?? "/portal"));

  return (
    <MembershipClassification
      initialUserType={user.user_type}
      returnTo={returnTo}
    />
  );
}
