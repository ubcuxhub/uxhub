import { notFound, redirect } from "next/navigation";

import { MembershipDetailsForm } from "./MembershipDetailsForm";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
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

  if (hasActiveOrPendingMembership(user)) {
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
