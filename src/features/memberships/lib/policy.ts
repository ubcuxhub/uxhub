import type {
  MembershipTypeRow,
  UserInfoRow,
  UserInfoUpdate,
  UserType,
} from "@/types/models";
import { hasActiveMembership } from "@/lib/membership";
import { isMembershipTermClosed } from "@/features/memberships/lib/expiry";
import {
  validateFacultyEmail,
  validateStudentNumber,
} from "@/features/memberships/lib/validation";

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
  | "user_type"
  | "year"
>;

/** The tier columns membership eligibility reads. */
export type MembershipEligibilityType = Pick<
  MembershipTypeRow,
  "eligible_user_types"
>;

/**
 * Whether the user holds a membership that blocks buying another one.
 *
 * A pre-order blocks unconditionally — it is pending, not expired, and the
 * payment may still land. A held membership only blocks while it is still
 * active: `membership_type_id` is never cleared when a membership lapses, so
 * checking it alone would leave every expired member permanently unable to
 * renew, and would lock the whole club out the day the term end passes.
 */
export function hasActiveOrPendingMembership(
  user: Pick<
    MembershipEligibilityUser,
    | "membership_expires_at"
    | "membership_pre_ordered_type_id"
    | "membership_type_id"
  >,
  termEndsAt: string | null,
) {
  if (user.membership_pre_ordered_type_id) return true;
  return hasActiveMembership(user, termEndsAt);
}

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
  ubcStudent: new Set(["faculty", "major", "student_number", "year"]),
  faculty: new Set(["faculty", "faculty_email"]),
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
  facultyEmail?: string | null;
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
  if (owned.has("faculty_email") && input.facultyEmail !== undefined) {
    update.faculty_email = input.facultyEmail?.trim() || null;
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
        user.major?.trim(),
    );
  }

  if (user.user_type === "faculty") {
    return validateFacultyEmail(user.faculty_email ?? "") === null;
  }

  return true;
}

/**
 * The single membership eligibility rule, shared by the portal UI and the
 * payment server action. `eligible_user_types` on the tier row is the source of
 * truth for which audiences may buy it — do not reintroduce a slug list here,
 * or the two checks drift and the UI offers purchases the server rejects.
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
    !isMembershipTermClosed(termEndsAt) &&
    !hasActiveOrPendingMembership(user, termEndsAt) &&
    isMembershipProfileComplete(user) &&
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
