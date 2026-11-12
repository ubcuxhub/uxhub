import type { AutosaveState } from "@/features/applications/lib/autosave";
import { getEffectiveMembershipExpiry } from "@/features/memberships/lib/expiry";
import { formatEventDate } from "@/lib/date";
import type { UserInfoRow, UserType } from "@/lib/supabase/models";

/**
 * The parts of the Profile tab that save on their own. Each has its own
 * autosave status beside its heading, so two sections saving at once never
 * overwrite each other's "Saved", and a failure shows next to what failed.
 */
export type ProfileSectionId = "photo" | "about" | "studies" | "dietary" | "interests";

export type ProfileSaveStates = Partial<Record<ProfileSectionId, AutosaveState>>;

/** Where the member stands with membership, as the header badge says it. */
export type MembershipSummary =
  | { kind: "active"; name: string | null; expiresOn: string | null }
  | { kind: "pending" }
  | { kind: "none" };

/**
 * A pre-order counts as pending even without a membership: it locks the
 * eligibility fields like an active membership does, so the header has to say
 * so or the lock reads as a bug.
 */
export function membershipSummary(
  user: Pick<
    UserInfoRow,
    "membership_type_id" | "membership_pre_ordered_type_id" | "membership_expires_at"
  >,
  membershipName: string | null,
  termEndsAt: string | null,
): MembershipSummary {
  if (user.membership_pre_ordered_type_id) return { kind: "pending" };
  if (!user.membership_type_id) return { kind: "none" };
  return {
    kind: "active",
    name: membershipName,
    // Effective date, not the raw column: a club-wide term end can cut a
    // membership short, and this is where members check it.
    expiresOn: formatEventDate(getEffectiveMembershipExpiry(user, termEndsAt), {
      month: "short",
    }),
  };
}

export function membershipLabel(summary: MembershipSummary): string {
  if (summary.kind === "pending") return "Payment processing";
  if (summary.kind === "none") return "Not a member";
  return summary.name ? `${summary.name} member` : "Member";
}

export const USER_TYPE_LABELS: Record<UserType, string> = {
  ubcStudent: "UBC student",
  faculty: "UBC faculty",
  nonUbc: "Non-UBC",
};

/** The eligibility section's heading for each kind of account. */
export const STUDIES_TITLES: Record<UserType, string> = {
  ubcStudent: "Studies",
  faculty: "At UBC",
  nonUbc: "School",
};

/** Admins and managers get a role badge; members don't need to be told. */
export function roleLabel(role: UserInfoRow["role_access"]): string | null {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return null;
}
