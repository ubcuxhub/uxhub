/**
 * The single membership expiry rule, shared by fulfillment and the checkout UI.
 *
 * A membership runs for one year from purchase, but never past the club-wide
 * term end (`app_settings.membership_term_ends_at`). Both the date stamped on
 * the member at fulfillment and the date shown to them before they pay come
 * from `resolveMembershipExpiry`, so the warning banner cannot promise a date
 * the payment handler will not honor.
 *
 * The term end is also re-checked at read time in `@/lib/membership` — stamping
 * alone would not let an admin move the date for members who already paid.
 */

function oneYearFrom(now: Date) {
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

/** The earlier of one year from `now` and the club-wide term end. */
export function resolveMembershipExpiry(
  termEndsAt: string | null,
  now = new Date()
): string {
  const fullYear = oneYearFrom(now);
  if (!termEndsAt) return fullYear.toISOString();

  const termEnd = new Date(termEndsAt);
  if (Number.isNaN(termEnd.getTime())) return fullYear.toISOString();

  return (termEnd < fullYear ? termEnd : fullYear).toISOString();
}

/**
 * True once the club-wide term has ended. Memberships cannot be sold in this
 * state — the purchase would expire the moment it was fulfilled.
 */
export function isMembershipTermClosed(
  termEndsAt: string | null,
  now = new Date()
): boolean {
  if (!termEndsAt) return false;

  const termEnd = new Date(termEndsAt);
  if (Number.isNaN(termEnd.getTime())) return false;

  return termEnd <= now;
}

/**
 * True when the term end is what actually shortens the membership, i.e. when a
 * buyer would get less than the full year. Drives the checkout warning: with no
 * term end, or one more than a year out, there is nothing surprising to say.
 */
export function termEndsBeforeFullYear(
  termEndsAt: string | null,
  now = new Date()
): boolean {
  if (isMembershipTermClosed(termEndsAt, now)) return false;
  if (!termEndsAt) return false;

  const termEnd = new Date(termEndsAt);
  if (Number.isNaN(termEnd.getTime())) return false;

  return termEnd < oneYearFrom(now);
}
