import type { MembershipTypeRow, UserInfoRow, UserType } from "@/types/models";
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

const ELIGIBLE_SLUGS: Record<UserType, readonly string[]> = {
  ubcStudent: ["explorer", "innovator"],
  faculty: ["faculty"],
  nonUbc: ["non-ubc"],
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

export function hasActiveOrPendingMembership(user: UserInfoRow) {
  return Boolean(
    user.membership_type_id || user.membership_pre_ordered_type_id,
  );
}

export function canEditMembershipClassification(user: UserInfoRow) {
  return !hasActiveOrPendingMembership(user);
}

export function isMembershipProfileComplete(user: UserInfoRow) {
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

export function getEligibleMembershipTypes(
  user: UserInfoRow,
  membershipTypes: MembershipTypeRow[],
) {
  if (hasActiveOrPendingMembership(user)) return [];
  const allowed = new Set(ELIGIBLE_SLUGS[user.user_type]);
  return membershipTypes.filter((membership) => allowed.has(membership.slug));
}

export function isEligibleForMembership(
  user: UserInfoRow,
  membership: MembershipTypeRow,
) {
  return (
    !hasActiveOrPendingMembership(user) &&
    isMembershipProfileComplete(user) &&
    ELIGIBLE_SLUGS[user.user_type].includes(membership.slug)
  );
}
