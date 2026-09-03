const PENDING_EMAIL_KEY = "uxhub-pending-auth-email";

/**
 * The address a confirmation screen is waiting on.
 *
 * Kept in session storage rather than the query string so it stays out of
 * browser history, referrers and server logs. Absence is expected — a refreshed
 * tab or a direct visit — and callers fall back to generic copy.
 */
export function setPendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // ignore storage failures (e.g. private mode)
  }
}

export function readPendingEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}
