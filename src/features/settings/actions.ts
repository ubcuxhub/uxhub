"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminDeleteAccount } from "@/lib/supabase-helpers/admin-server";
import { fetchUserSetup, updateUserSetup } from "@/lib/supabase-helpers/setup";
import type { InterestId } from "@/features/setup/lib/options";
import { toSetupState, type SetupState } from "@/features/setup/lib/state";
import { parseInterests } from "@/features/setup/lib/validation";
import { matchesConfirmationEmail } from "./lib/account-deletion";
import { mergeMemberInterests } from "./lib/interests";

/**
 * Settings' interests chips. Unlike setup's `finishSetupAction`, it keeps the
 * free tags managers added to the same column and leaves `setup_step` alone,
 * so editing interests here neither drops a manager's tags nor ends setup.
 * The service role writes, as `interests` has no member grant, and only the
 * signed-in member's own row.
 */
export async function saveInterestsAction(input: { interests: InterestId[] }): Promise<SetupState> {
  const user = await requireAuth();
  try {
    const chosen = parseInterests(input?.interests);
    const current = await fetchUserSetup(supabaseAdmin, user.id);
    const row = await updateUserSetup(supabaseAdmin, user.id, {
      interests: mergeMemberInterests(current.interests, chosen),
    });
    revalidatePath("/", "layout");
    return toSetupState(row);
  } catch (error) {
    log.warn("settings.interests_save_failed", { userId: user.id, ...errorFields(error) });
    throw error;
  }
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently deletes the signed-in member's account.
 *
 * The caller is identified by their session rather than by anything passed in,
 * so the confirmation email is only ever a statement of intent — it can never
 * select which account to delete. Re-checking it here is what makes the
 * dialog's disabled button more than a suggestion.
 *
 * The browser must still call `supabase.auth.signOut()` afterwards: this
 * destroys the auth user, but the now-dead session cookie stays in the browser
 * until it is cleared.
 */
export async function deleteAccountAction(
  confirmationEmail: string
): Promise<DeleteAccountResult> {
  // Keep authentication outside the deletion catch. `requireAuth` redirects by
  // throwing a Next control-flow exception, which must reach the framework.
  const user = await requireAuth();

  if (!matchesConfirmationEmail(confirmationEmail, user.email)) {
    return {
      ok: false,
      error: "That does not match the email address on this account.",
    };
  }

  if (!user.auth_user_id) {
    return {
      ok: false,
      error:
        "This profile is not linked to a sign-in, so there is nothing to delete. Contact the UX Hub team for help.",
    };
  }

  try {
    await adminDeleteAccount(user.auth_user_id);

    return { ok: true };
  } catch (error) {
    log.error("account.deletion_failed", errorFields(error));

    return { ok: false, error: "Your account could not be deleted." };
  }
}
