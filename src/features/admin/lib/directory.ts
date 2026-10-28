import type { UserRecord } from "../types";

export function toggleSetValue<T>(values: Set<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/** Non-UBC memberships use the saved institution; all other selections imply UBC. */
export function displaySchool(
  user: Pick<UserRecord, "school_institution" | "membership_type_name">,
  membershipTypeName = user.membership_type_name,
): string | null {
  return membershipTypeName === "nonUbc"
    ? user.school_institution || null
    : "University of British Columbia";
}
