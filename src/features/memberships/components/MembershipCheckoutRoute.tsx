import { notFound, redirect } from "next/navigation";

import { MembershipCheckout } from "./MembershipCheckout";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchMembershipTypeBySlug,
  fetchMembershipTypes,
} from "@/lib/supabase-helpers/memberships";
import { withReturnTo } from "@/lib/auth/paths";
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
  const [membershipType, membershipTypes] = await Promise.all([
    fetchMembershipTypeBySlug(supabase, slug),
    fetchMembershipTypes(supabase, { orderBy: "price" }),
  ]);

  if (!membershipType) notFound();
  if (!isEligibleForMembership(user, membershipType)) {
    redirect(withReturnTo("/portal/membership", returnTo));
  }

  const eligible = getEligibleMembershipTypes(user, membershipTypes);
  const backHref =
    eligible.length > 1
      ? "/portal/membership"
      : membershipDetailsPath(user.user_type);

  return (
    <MembershipCheckout
      backHref={backHref}
      membershipType={membershipType}
      returnTo={returnTo}
      user={user}
    />
  );
}
