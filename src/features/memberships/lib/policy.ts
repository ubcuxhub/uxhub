import type {
  MembershipTypeRow,
  UserInfoRow,
  UserInfoUpdate,
  UserType,
} from "@/lib/supabase/models";
import {
  hasActiveOrPendingMembership,
  isMembershipTermClosed,
} from "@/features/memberships/lib/expiry";
import { validateStudentNumber } from "@/features/memberships/lib/validation";
import {
  hasPurchaseUbcVerification,
  normalizeUbcEmail,
  tierRequiresUbcVerification,
  validateUbcEmail,
} from "@/features/memberships/lib/ubc-verification";

export const MEMBERSHIP_AUDIENCES = [
  "student",
  "faculty",
  "non-ubc",
] as const;

export type MembershipAudience = (typeof MEMBERSHIP_AUDIENCES)[number];

const AUDIENCE_TO_USER_TYPE: Record<MembershipAudience, UserType> = {
  student: "ubcStudent",
  faculty: "faculty",
  "non-ubc": "nonUbc",
};

const USER_TYPE_TO_AUDIENCE: Record<UserType, MembershipAudience> = {
  ubcStudent: "student",
  faculty: "faculty",
  nonUbc: "non-ubc",
};

export function isMembershipAudience(value: string): value is MembershipAudience {
  return MEMBERSHIP_AUDIENCES.includes(value as MembershipAudience);
}

export function audienceToUserType(audience: MembershipAudience): UserType {
  return AUDIENCE_TO_USER_TYPE[audience];
}

export function userTypeToAudience(userType: UserType): MembershipAudience {
  return USER_TYPE_TO_AUDIENCE[userType];
}

export function membershipDetailsPath(userType: UserType) {
  return `/portal/membership/join/${userTypeToAudience(userType)}`;
}

/** The join flow's "What best describes you?" step, asked again on purpose. */
export const CHANGE_USER_TYPE_PATH = "/portal/membership/join?change=1";

/**
 * Where the join flow's first step sends a member who already answered
 * "What best describes you?" (in setup or an earlier join): straight to the
 * details for that type. Null asks the question: never answered, or the
 * member chose to change it.
 */
export function confirmedJoinPath(
  user: Pick<UserInfoRow, "user_type" | "user_type_confirmed_at">,
  changing: boolean,
): string | null {
  if (changing || !user.user_type_confirmed_at) return null;
  return membershipDetailsPath(user.user_type);
}

/**
 * The stamp a save writes whenever the member answers "What best describes
 * you?" (join details, or eligibility in Settings), so join skips the
 * question next time.
 */
export function userTypeConfirmation(now = new Date()): Pick<UserInfoUpdate, "user_type_confirmed_at"> {
  return { user_type_confirmed_at: now.toISOString() };
}

/**
 * The user columns membership eligibility reads. Narrower than `UserInfoRow` so
 * server actions can pass a partial row and tests can build fixtures.
 */
export type MembershipEligibilityUser = Pick<
  UserInfoRow,
  | "faculty"
  | "faculty_email"
  | "major"
  | "membership_expires_at"
  | "membership_pre_ordered_type_id"
  | "membership_type_id"
  | "student_number"
  | "ubc_email"
  | "ubc_verified_at"
  | "ubc_verified_via"
  | "user_type"
  | "year"
>;

/** The tier columns membership eligibility reads. */
export type MembershipEligibilityType = Pick<
  MembershipTypeRow,
  "active" | "eligible_user_types"
>;

/**
 * Whether an unverified UBC member must verify before buying, given the tiers
 * on offer: some active tier for their type is for UBC audiences alone. The
 * plans route sends them to the code step then, instead of listing only the
 * tiers they could buy unverified.
 */
export function needsUbcVerificationForTiers(
  user: MembershipEligibilityUser,
  membershipTypes: MembershipEligibilityType[],
) {
  if (hasPurchaseUbcVerification(user)) return false;
  return membershipTypes.some(
    (membership) =>
      membership.active &&
      membership.eligible_user_types.includes(user.user_type) &&
      tierRequiresUbcVerification(membership),
  );
}

export { hasActiveOrPendingMembership };

export function canEditMembershipClassification(
  user: UserInfoRow,
  termEndsAt: string | null,
) {
  return !hasActiveOrPendingMembership(user, termEndsAt);
}

/**
 * Every profile column that belongs to one classification rather than all of
 * them. A classification change owns some of these and must clear the rest.
 */
const ELIGIBILITY_COLUMNS = [
  "faculty",
  "faculty_email",
  "major",
  "school_institution",
  "student_number",
  "student_status",
  "ubc_email",
  "year",
] as const;

type EligibilityColumn = (typeof ELIGIBILITY_COLUMNS)[number];

/**
 * Which of those columns each classification keeps. Mirrors the three branches
 * of `saveMembershipProfileAction`; anything absent here is cleared on the way
 * in, so a column the profile UI hides for a classification can never hold a
 * stale value from a previous one.
 */
const OWNED_COLUMNS: Record<UserType, ReadonlySet<EligibilityColumn>> = {
  ubcStudent: new Set(["faculty", "major", "student_number", "ubc_email", "year"]),
  faculty: new Set(["faculty", "faculty_email", "ubc_email"]),
  nonUbc: new Set(["school_institution", "student_status", "year"]),
};

/**
 * The update a classification change writes.
 *
 * Owned columns the caller says nothing about are left out entirely, so
 * correcting a student number does not disturb the major or year sitting
 * beside it. Unowned columns are nulled — hidden must mean empty, or a switch
 * away and back would resurrect details the member can no longer see or edit.
 */
export function buildEligibilityUpdate(input: {
  userType: UserType;
  studentNumber: number | null;
  faculty?: string | null;
  /**
   * The UBC address. Faculty also mirror it into `faculty_email`, which the
   * code in production reads until a cleanup migration drops it.
   */
  ubcEmail?: string | null;
}): UserInfoUpdate {
  const owned = OWNED_COLUMNS[input.userType];
  const update: UserInfoUpdate = { user_type: input.userType };

  for (const column of ELIGIBILITY_COLUMNS) {
    if (!owned.has(column)) update[column] = null;
  }
  if (owned.has("student_number")) {
    update.student_number = input.studentNumber;
  }
  if (owned.has("faculty") && input.faculty !== undefined) {
    update.faculty = input.faculty?.trim() || null;
  }
  if (owned.has("ubc_email") && input.ubcEmail !== undefined) {
    update.ubc_email = input.ubcEmail ? normalizeUbcEmail(input.ubcEmail) || null : null;
    if (owned.has("faculty_email")) update.faculty_email = update.ubc_email;
  }
  return update;
}

export function isMembershipProfileComplete(user: MembershipEligibilityUser) {
  if (user.user_type === "ubcStudent") {
    return Boolean(
      user.student_number &&
        validateStudentNumber(String(user.student_number)) === null &&
        user.faculty &&
        user.year &&
        user.major?.trim() &&
        validateUbcEmail(user.ubc_email ?? "", "student") === null,
    );
  }

  if (user.user_type === "faculty") {
    return validateUbcEmail(user.ubc_email ?? "", "faculty") === null;
  }

  return true;
}

/**
 * The single membership eligibility rule, shared by the portal UI and the
 * payment server action. `eligible_user_types` on the tier row is the source of
 * truth for which audiences may buy it — do not reintroduce a slug list here,
 * or the two checks drift and the UI offers purchases the server rejects.
 *
 * A tier for UBC audiences alone also needs a purchase-valid UBC
 * verification (`hasPurchaseUbcVerification`), so the checkout route and the
 * payment action refuse an unverified member. A tier Non-UBC members can buy
 * too isn't gated (`tierRequiresUbcVerification`).
 *
 * `termEndsAt` closes sales once the club-wide term has ended. Enforcing it
 * here rather than only in the UI is what stops a direct link to the checkout
 * route from taking a payment for a membership that would expire immediately.
 */
export function isEligibleForMembership(
  user: MembershipEligibilityUser,
  membership: MembershipEligibilityType,
  termEndsAt: string | null,
) {
  return (
    membership.active &&
    !isMembershipTermClosed(termEndsAt) &&
    !hasActiveOrPendingMembership(user, termEndsAt) &&
    isMembershipProfileComplete(user) &&
    (!tierRequiresUbcVerification(membership) || hasPurchaseUbcVerification(user)) &&
    membership.eligible_user_types.includes(user.user_type)
  );
}

export function getEligibleMembershipTypes(
  user: MembershipEligibilityUser,
  membershipTypes: MembershipTypeRow[],
  termEndsAt: string | null,
) {
  return membershipTypes.filter((membership) =>
    isEligibleForMembership(user, membership, termEndsAt),
  );
}
