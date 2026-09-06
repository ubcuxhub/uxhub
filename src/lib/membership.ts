import type { UserInfoRow } from "@/types/models";

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
  const own = user?.membership_expires_at ?? null;
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
 * components read it with `fetchMembershipTermEndsAt`; client components take
 * it from `useUser()`.
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
