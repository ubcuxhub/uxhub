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
  profile:
    "Unable to finish creating your profile. Check your connection and try again.",
} as const;

export function getAuthActionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return isAsyncTimeoutError(error)
    ? getAsyncErrorMessage(error, fallback)
    : fallback;
}
