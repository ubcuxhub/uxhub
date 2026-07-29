import type { MembershipTypeRow, UserInfoRow } from "@/types/models";

export function isMembershipPurchasableForUser(
  user: Pick<
    UserInfoRow,
    | "membership_type_id"
    | "membership_pre_ordered_type_id"
    | "student_number"
    | "user_type"
  >,
  membership: Pick<MembershipTypeRow, "eligible_user_types">
) {
  if (user.membership_type_id || user.membership_pre_ordered_type_id) {
    return false;
  }

  return (
    membership.eligible_user_types.includes(user.user_type) &&
    (user.user_type !== "ubcStudent" || Boolean(user.student_number))
  );
}
