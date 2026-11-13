/**
 * The one password rule, shared by sign-up and the reset form. The hosted and
 * local Supabase `minimum_password_length` must match it, or the server
 * rejects what the client allows.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** The hint shown under a password field. */
export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters.`;

/** The error shown once the rule fails. */
export const PASSWORD_TOO_SHORT_ERROR = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
