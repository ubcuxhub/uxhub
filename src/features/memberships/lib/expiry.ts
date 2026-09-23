import type { UserInfoRow } from "@/lib/supabase/models";

/**
 * When a membership ends, at purchase time and at read time.
 *
 * A membership runs for one year from purchase, but never past the club-wide
 * term end (`app_settings.membership_term_ends_at`). Both the date stamped on
 * the member at fulfillment and the date shown to them before they pay come
 * from `resolveMembershipExpiry`, so the warning banner cannot promise a date
 * the payment handler will not honor.
 *
 * Stamping alone would not let an admin move the date for members who already
 * paid, so `getEffectiveMembershipExpiry` and `hasActiveMembership` apply the
 * term end again whenever a member is read.
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

export type MembershipExpiryUser = Pick<
  UserInfoRow,
  "membership_type_id" | "membership_expires_at"
>;

/**
 * When a member's access actually ends: the earlier of their own expiry and
 * the club-wide term end (`app_settings.membership_term_ends_at`), or null when
 * neither is set.
 *
 * The term end is applied here, at read time, rather than only being stamped
 * onto the member at fulfillment. That is what makes the date movable — an
 * admin can pull it in or push it out and every member reflects the change on
 * their next request, with no backfill, and clearing it restores members who
 * had been cut short.
 */
export function getEffectiveMembershipExpiry(
  user: MembershipExpiryUser | null | undefined,
  termEndsAt: string | null,
): string | null {
  if (!user?.membership_type_id) return null;

  const own = user.membership_expires_at ?? null;
  if (!own) return termEndsAt;
  if (!termEndsAt) return own;
  return new Date(termEndsAt) < new Date(own) ? termEndsAt : own;
}

/**
 * A membership is active when the user has a membership type and its effective
 * expiry is either unset or still in the future.
 *
 * `termEndsAt` is required rather than optional on purpose: every call site has
 * to decide where it gets the term end from, so forgetting to pass it is a type
 * error instead of a member who silently stays active past the cutoff. Server
 * components read it with `getMembershipTermEndsAt` from `./term`; client
 * components take it from `useUser()`.
 */
export function hasActiveMembership(
  user: MembershipExpiryUser | null | undefined,
  termEndsAt: string | null,
): boolean {
  if (!user?.membership_type_id) return false;

  const expiry = getEffectiveMembershipExpiry(user, termEndsAt);
  if (!expiry) return true;
  return new Date(expiry) > new Date();
}
