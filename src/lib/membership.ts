import type { UserInfoRow } from "@/types/models";

/**
 * A membership is active when the user has a membership type and either no
 * expiry or an expiry still in the future.
 */
export function hasActiveMembership(
  user: Pick<UserInfoRow, "membership_type_id" | "membership_expires_at"> | null | undefined,
): boolean {
  if (!user?.membership_type_id) return false;
  if (!user.membership_expires_at) return true;
  return new Date(user.membership_expires_at) > new Date();
}
