"use server";

import { requireAuth } from "@/lib/auth/guards";
import { adminDeleteAccount } from "@/lib/supabase-helpers/admin-server";
import { matchesConfirmationEmail } from "./lib/account-deletion";

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
  try {
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

    await adminDeleteAccount(user.auth_user_id);

    return { ok: true };
  } catch (error) {
    // Supabase rejections are plain `{ message, code, details, hint }` objects,
    // not Error instances, so an `instanceof Error` check drops the one piece of
    // information worth having. Log the cause server-side and keep the message
    // shown to the member generic — a database error is not theirs to read.
    console.error("Account deletion failed", describeError(error));

    return { ok: false, error: "Your account could not be deleted." };
  }
}

/** Best-effort readable cause for the server log, whatever the throw shape. */
function describeError(error: unknown): unknown {
  if (error instanceof Error) return error;

  if (error && typeof error === "object" && "message" in error) {
    const { message, code, details, hint } = error as Record<string, unknown>;
    return { message, code, details, hint };
  }

  return error;
}
