import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
} from "@/lib/async/deadline";

export const AUTH_ACTION_ERRORS = {
  signIn:
    "Unable to sign in. Check your email and password, then try again.",
  signUp: "Unable to create your account. Check your details and try again.",
  google:
    "Unable to continue with Google. Check your connection and try again.",
  resend: "Unable to resend the email. Check your connection and try again.",
  passwordReset:
    "Unable to send a reset link. Check your connection and try again.",
  passwordUpdate:
    "Unable to update your password. Check your connection and try again.",
} as const;

export const INVALID_CREDENTIALS_MESSAGE =
  "That email and password don't match. Try again or reset your password.";

export const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";

export function getAuthActionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return isAsyncTimeoutError(error)
    ? getAsyncErrorMessage(error, fallback)
    : fallback;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

/** Supabase refuses to sign in an account whose email isn't confirmed yet. */
export function isEmailNotConfirmedError(error: unknown): boolean {
  return (
    getErrorCode(error) === "email_not_confirmed" ||
    /email not confirmed/i.test(getErrorMessage(error))
  );
}

export function isInvalidCredentialsError(error: unknown): boolean {
  return (
    getErrorCode(error) === "invalid_credentials" ||
    /invalid login credentials/i.test(getErrorMessage(error))
  );
}

/** A plain address check; the server stays the authority. */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
