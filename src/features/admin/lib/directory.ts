import type { UserInfoRow } from "@/lib/supabase/models";

export function toggleSetValue<T>(values: Set<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * The school the admin directory shows. Sign-up stores a school only for
 * non-UBC members and clears it for UBC students and faculty, whose school is
 * implied by their type, so it is derived for them rather than read.
 */
export function displaySchool(
  user: Pick<UserInfoRow, "school_institution" | "user_type">
): string | null {
  if (user.school_institution) return user.school_institution;
  return user.user_type === "ubcStudent" || user.user_type === "faculty"
    ? "University of British Columbia"
    : null;
}
