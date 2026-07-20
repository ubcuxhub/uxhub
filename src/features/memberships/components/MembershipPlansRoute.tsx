import { redirect } from "next/navigation";

import { MembershipPlans } from "./MembershipPlans";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypes } from "@/lib/supabase-helpers/memberships";
import { withReturnTo } from "@/lib/auth/paths";
import {
  getEligibleMembershipTypes,
  hasActiveOrPendingMembership,
  isMembershipProfileComplete,
  membershipDetailsPath,
} from "@/features/memberships/lib/policy";

function MembershipStatus({ pending }: { pending: boolean }) {
  return (
    <div className="flex min-h-full items-center justify-center text-center">
      <div className="max-w-md">
        <h1 className="text-h2">
          {pending ? "Membership pending" : "You’re already a member"}
        </h1>
        <p className="mt-2 text-small text-muted-foreground">
          {pending
            ? "Your membership purchase is still being processed."
            : "Your account already has an active UX Hub membership."}
        </p>
      </div>
    </div>
  );
}

export async function MembershipPlansRoute({ returnTo }: { returnTo?: string }) {
  const user = await requireAuth(withReturnTo("/portal/membership", returnTo));

  if (hasActiveOrPendingMembership(user)) {
    return (
      <MembershipStatus pending={Boolean(user.membership_pre_ordered_type_id)} />
    );
  }

  if (!isMembershipProfileComplete(user)) {
    redirect(withReturnTo(membershipDetailsPath(user.user_type), returnTo));
  }

  const supabase = await createClient();
  const membershipTypes = await fetchMembershipTypes(supabase, {
    orderBy: "price",
  });
  const eligible = getEligibleMembershipTypes(user, membershipTypes);

  if (eligible.length === 1) {
    redirect(
      withReturnTo(
        `/portal/membership/${eligible[0].slug}/checkout`,
        returnTo,
      ),
    );
  }

  if (eligible.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center text-center">
        <div className="max-w-md">
          <h1 className="text-h2">Membership unavailable</h1>
          <p className="mt-2 text-small text-muted-foreground">
            No membership has been configured for your profile. Please contact
            UX Hub for help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MembershipPlans
      membershipTiers={eligible}
      returnTo={returnTo}
      userType={user.user_type}
    />
  );
}
