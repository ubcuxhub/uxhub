import { notFound, redirect } from "next/navigation";

import { MembershipDetailsForm, type UbcDetails } from "./MembershipDetailsForm";
import { getConfirmedSignInEmail } from "@/lib/auth/current-user";
import { requireAuth } from "@/lib/auth/guards";
import { withReturnTo } from "@/lib/auth/paths";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchPendingUbcCode } from "@/lib/supabase-helpers/ubc-verification";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import {
  hasActiveOrPendingMembership,
  isMembershipAudience,
  userTypeToAudience,
} from "@/features/memberships/lib/policy";
import {
  hasPurchaseUbcVerification,
  normalizeUbcEmail,
  ubcEmailQualifies,
} from "@/features/memberships/lib/ubc-verification";

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

  const ubc: UbcDetails = { signInEmail: null, pending: null };
  if (audience !== "non-ubc") {
    const confirmed = await getConfirmedSignInEmail();
    if (confirmed && ubcEmailQualifies(confirmed, audience)) {
      ubc.signInEmail = normalizeUbcEmail(confirmed);
    }
    // Reopen the code state for a code still live for the saved address, so
    // a refresh or a reopened dialog doesn't lose it.
    if (
      userTypeToAudience(user.user_type) === audience &&
      user.ubc_email &&
      !hasPurchaseUbcVerification(user)
    ) {
      try {
        const pending = await fetchPendingUbcCode(supabaseAdmin, user.id);
        if (pending?.email === user.ubc_email) ubc.pending = pending;
      } catch (error) {
        // The form still works; the member can ask for a new code.
        log.error("ubc_verification.pending_load_failed", {
          userId: user.id,
          ...errorFields(error),
        });
      }
    }
  }

  return (
    <MembershipDetailsForm
      audience={audience}
      returnTo={returnTo}
      ubc={ubc}
      user={user}
    />
  );
}
