import { notFound, redirect } from "next/navigation";

import { MembershipDetailsForm } from "./MembershipDetailsForm";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
import { getMembershipTermEndsAt } from "@/lib/app-settings";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import {
  hasActiveOrPendingMembership,
  isMembershipAudience,
} from "@/features/memberships/lib/policy";

export async function MembershipDetailsRoute({
  audience,
  returnTo,
}: {
  audience: string;
  returnTo?: string;
}) {
  if (!isMembershipAudience(audience)) notFound();
  const user = await requireAuth(
    withReturnTo(`/portal/membership/join/${audience}`, returnTo),
  );

  const termEndsAt = await getMembershipTermEndsAt();

  if (
    isMembershipTermClosed(termEndsAt) ||
    hasActiveOrPendingMembership(user, termEndsAt)
  ) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  return (
    <MembershipDetailsForm
      audience={audience}
      returnTo={returnTo}
      user={user}
    />
  );
}
