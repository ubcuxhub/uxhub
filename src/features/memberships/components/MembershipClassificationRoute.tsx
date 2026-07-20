import { redirect } from "next/navigation";

import { MembershipClassification } from "./MembershipClassification";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
import { hasActiveOrPendingMembership } from "@/features/memberships/lib/policy";

export async function MembershipClassificationRoute({
  returnTo,
}: {
  returnTo?: string;
}) {
  const user = await requireAuth(
    withReturnTo("/portal/membership/join", returnTo),
  );

  if (hasActiveOrPendingMembership(user)) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  return (
    <MembershipClassification
      initialUserType={user.user_type}
      returnTo={returnTo}
    />
  );
}
