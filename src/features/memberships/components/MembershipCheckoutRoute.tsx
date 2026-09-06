import { notFound, redirect } from "next/navigation";

import { MembershipCheckout } from "./MembershipCheckout";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchMembershipTypeBySlug,
  fetchMembershipTypes,
} from "@/lib/supabase-helpers/memberships";
import { withReturnTo } from "@/lib/auth/paths";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import {
  resolveMembershipExpiry,
  termEndsBeforeFullYear,
} from "@/features/memberships/lib/expiry";
import {
  getEligibleMembershipTypes,
  isEligibleForMembership,
  membershipDetailsPath,
} from "@/features/memberships/lib/policy";

export async function MembershipCheckoutRoute({
  returnTo,
  slug,
}: {
  returnTo?: string;
  slug: string;
}) {
  const user = await requireAuth(
    withReturnTo(`/portal/membership/${slug}/checkout`, returnTo),
  );
  const supabase = await createClient();
  const [membershipType, membershipTypes, termEndsAt] = await Promise.all([
    fetchMembershipTypeBySlug(supabase, slug),
    fetchMembershipTypes(supabase, { orderBy: "price" }),
    fetchMembershipTermEndsAt(supabase),
  ]);

  if (!membershipType) notFound();
  // Also covers a closed term, so a direct link here cannot start a payment.
  if (!isEligibleForMembership(user, membershipType, termEndsAt)) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  const eligible = getEligibleMembershipTypes(
    user,
    membershipTypes,
    termEndsAt,
  );
  const backHref =
    eligible.length > 1
      ? "/portal/membership"
      : membershipDetailsPath(user.user_type);

  // Only worth saying when the term end is what cuts the year short. The date
  // comes from the same rule fulfillment stamps, so the promise is kept.
  const shortenedExpiry = termEndsBeforeFullYear(termEndsAt)
    ? resolveMembershipExpiry(termEndsAt)
    : null;

  return (
    <MembershipCheckout
      backHref={backHref}
      expiresAt={shortenedExpiry}
      membershipType={membershipType}
      returnTo={returnTo}
      user={user}
    />
  );
}
