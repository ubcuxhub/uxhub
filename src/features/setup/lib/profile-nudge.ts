import type { UserInfoRow } from "@/lib/supabase/models";

/** Set once the member dismisses the "Complete your profile" card. */
export const PROFILE_NUDGE_COOKIE = "uxhub_profile_nudge_dismissed";

/** One year, in seconds. */
export const PROFILE_NUDGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Whether the portal home asks a member to add their interests. Only members
 * who finished (or were backfilled past) setup, so it never competes with the
 * setup flow. Empty dietary arrays are a valid answer, so interests are the
 * only signal that the profile is incomplete.
 */
export function shouldShowProfileNudge(
  user: Pick<UserInfoRow, "setup_step" | "interests">,
  dismissed: boolean,
): boolean {
  return user.setup_step === "done" && user.interests.length === 0 && !dismissed;
}
