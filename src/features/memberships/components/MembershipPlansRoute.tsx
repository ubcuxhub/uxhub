import { redirect } from "next/navigation";

import { MembershipPlans } from "./MembershipPlans";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypes } from "@/lib/supabase-helpers/memberships";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { withReturnTo } from "@/lib/auth/paths";
import {
  isMembershipTermClosed,
} from "@/features/memberships/lib/expiry";
import {
  getEligibleMembershipTypes,
  hasActiveOrPendingMembership,
  isMembershipProfileComplete,
  membershipDetailsPath,
} from "@/features/memberships/lib/policy";

function MembershipNotice({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center text-center">
      <div className="max-w-md">
        <h1 className="text-h2">{title}</h1>
        <p className="mt-2 text-small text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export async function MembershipPlansRoute({ returnTo }: { returnTo?: string }) {
  const user = await requireAuth(withReturnTo("/portal/membership", returnTo));
  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);

  if (hasActiveOrPendingMembership(user, termEndsAt)) {
    const pending = Boolean(user.membership_pre_ordered_type_id);
    return (
      <MembershipNotice
        title={pending ? "Membership pending" : "You’re already a member"}
        body={
          pending
            ? "Your membership purchase is still being processed."
            : "Your account already has an active UX Hub membership."
        }
      />
    );
  }

  // Checked after the member case so existing members still see their status
  // rather than a closure notice that does not apply to them.
  if (isMembershipTermClosed(termEndsAt)) {
    return (
      <MembershipNotice
        title="Memberships are closed"
        body="Memberships for the current UX Hub term have ended. Check back next term."
      />
    );
  }

  if (!isMembershipProfileComplete(user)) {
    redirect(withReturnTo(membershipDetailsPath(user.user_type), returnTo));
  }

  const membershipTypes = await fetchMembershipTypes(supabase, {
    orderBy: "price",
  });
  const eligible = getEligibleMembershipTypes(user, membershipTypes, termEndsAt);

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
