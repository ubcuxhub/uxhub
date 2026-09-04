/**
 * The confirmation rule for permanent account deletion.
 *
 * Shared so the dialog's disabled state and the server action's gate agree on
 * what counts as a match. The client check is convenience; the server one is
 * the check that matters.
 */

/** Domain the `delete_account` migration rewrites deleted addresses to. */
export const DELETED_EMAIL_DOMAIN = "deleted.uxhub.invalid";

/**
 * True when the typed confirmation names the signed-in account. Case and
 * surrounding whitespace are forgiven — the point is deliberate intent, not a
 * typing test — but the address itself must match exactly.
 */
export function matchesConfirmationEmail(
  typed: string,
  accountEmail: string
): boolean {
  const normalizedAccountEmail = accountEmail.trim().toLowerCase();

  if (!normalizedAccountEmail) return false;

  return typed.trim().toLowerCase() === normalizedAccountEmail;
}
