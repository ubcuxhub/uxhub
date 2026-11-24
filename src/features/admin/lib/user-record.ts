import type { UserInfoRow } from "@/lib/supabase/models";
import type { UserListRecord, UserRecord } from "../types";

/** A `user_info` row with its membership tier embedded, as the admin queries return it. */
export type UserRowWithMembership = UserInfoRow & {
  membership_types?: { name: string } | { name: string }[] | null;
};

/**
 * One admin user record from a `user_info` row: the embedded tier becomes
 * `membership_type_name`, and the deprecated order date is exposed as
 * `order_date`, the name the edit form uses.
 */
export function toUserRecord(row: UserRowWithMembership): UserRecord {
  const { membership_types: membership, ...user } = row;
  const membershipTypeName = Array.isArray(membership)
    ? membership[0]?.name ?? null
    : membership?.name ?? null;
  return {
    ...user,
    membership_type_name: membershipTypeName,
    order_date: user.order_date_deprecated,
  };
}

/** A directory row from its listed columns, with the embedded tier as `membership_type_name`. */
export function toUserListRecord<
  T extends Omit<UserListRecord, "membership_type_name"> & {
    membership_types?: { name: string } | { name: string }[] | null;
  },
>(row: T): UserListRecord {
  const { membership_types: membership, ...user } = row;
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    major: user.major,
    role_access: user.role_access,
    membership_type_id: user.membership_type_id,
    created_at: user.created_at,
    membership_type_name: Array.isArray(membership)
      ? membership[0]?.name ?? null
      : membership?.name ?? null,
  };
}

/** A saved row (from an action or the photo route) merged into the record it updates. */
export function mergeSavedUser(
  record: UserRecord,
  saved: UserInfoRow,
  membershipTypes: { id: string; name: string }[],
): UserRecord {
  return {
    ...record,
    ...saved,
    order_date: saved.order_date_deprecated,
    membership_type_name:
      saved.membership_type_id === record.membership_type_id
        ? record.membership_type_name
        : membershipTypes.find((tier) => tier.id === saved.membership_type_id)?.name ?? null,
  };
}
