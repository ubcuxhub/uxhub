import type { Metadata } from "next";

import { hasActiveOrPendingMembership } from "@/features/memberships/lib/policy";
import { getMembershipTermEndsAt } from "@/features/memberships/lib/term";
import { SetupFlow } from "@/features/setup/components/SetupFlow";
import { toSetupState } from "@/features/setup/lib/state";
import { requireAuth } from "@/lib/auth/guards";
import { formatUserName } from "@/lib/user-name";

export const metadata: Metadata = { title: "Set up your profile · UBC UX Hub" };

/**
 * Setup resumes at the member's stored step. A member who already finished
 * (or skipped to the end) can come back: they start at step 1 with their
 * answers filled in, and saving never sends them back through the gate.
 */
export default async function SetupPage() {
  const user = await requireAuth();
  const firstName = user.first_name || user.email.split("@")[0] || "there";
  // A held or pre-ordered membership was sold for the stored type.
  const userTypeLocked = hasActiveOrPendingMembership(user, await getMembershipTermEndsAt());

  return (
    <SetupFlow
      initial={toSetupState(user)}
      name={formatUserName(user) || firstName}
      firstName={firstName}
      userTypeLocked={userTypeLocked}
    />
  );
}
