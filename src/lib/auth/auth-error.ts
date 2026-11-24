import { getSafeInternalPath } from "@/lib/auth/paths";

/**
 * Copy for `/auth/error`, chosen by a fixed code in the URL. The page never
 * renders URL text: `?error=<anything>` would let a crafted link show
 * attacker-written copy under UX Hub's branding.
 */
export const AUTH_ERROR_MESSAGES = {
  callback:
    "We couldn't complete sign-in. The link may have expired or already been used. Try signing in again.",
  timeout:
    "This is taking longer than expected. Check your connection and try again.",
  profile_unavailable: "Unable to load your profile.",
  missing_email: "Your account is missing an email address.",
  linked_elsewhere:
    "An account with this email is already linked to another sign-in method.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

const DEFAULT_AUTH_ERROR_MESSAGE =
  "We couldn't complete authentication. Please try signing in again.";

function isAuthErrorCode(value: string): value is AuthErrorCode {
  return Object.hasOwn(AUTH_ERROR_MESSAGES, value);
}

/** The copy for a code from the URL; anything unknown gets the generic line. */
export function authErrorMessage(code: string | null | undefined): string {
  return code && isAuthErrorCode(code)
    ? AUTH_ERROR_MESSAGES[code]
    : DEFAULT_AUTH_ERROR_MESSAGE;
}

/** `/auth/error` for `code`, carrying a sanitized `next` when there is one. */
export function authErrorPath(
  code: AuthErrorCode,
  nextPath?: string | null,
): string {
  const params = new URLSearchParams({ code });
  if (nextPath) params.set("next", getSafeInternalPath(nextPath));
  return `/auth/error?${params.toString()}`;
}
