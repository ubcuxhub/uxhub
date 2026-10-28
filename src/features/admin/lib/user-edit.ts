import type { RoleAccess } from "@/lib/supabase/models";
import type { MembershipTypeOption, UserRecord } from "../types";
import { normalizeInterests, validateBirthDate } from "./user-profile";

export const USER_EDIT_FIELDS = [
  "first_name", "last_name", "email", "phone", "newsletter", "membership_type_id",
  "major", "student_number", "faculty", "year", "order_date", "school_institution",
] as const;
export type UserEditField = typeof USER_EDIT_FIELDS[number];
export interface UserEditDraft {
  fields: Record<UserEditField, string>;
  birthDate: string;
  interests: string[];
  newInterest: string;
  verified: boolean;
  role: RoleAccess;
  photo?: { file: File; preview: string } | null;
}

/** Resolve the draft tier, retaining the name of an inactive current membership. */
export function canEditUserSchool(user: UserRecord, membershipTypeId: string | null, membershipTypes: MembershipTypeOption[]): boolean {
  if (!membershipTypeId) return false;
  const name = membershipTypes.find((tier) => tier.id === membershipTypeId)?.name ??
    (membershipTypeId === user.membership_type_id ? user.membership_type_name : null);
  return name === "nonUbc";
}

export function createUserEditDraft(user: UserRecord): UserEditDraft {
  return {
    fields: Object.fromEntries(USER_EDIT_FIELDS.map((field) => [field,
      field === "order_date" ? user.order_date_deprecated ?? "" : String(user[field] ?? ""),
    ])) as UserEditDraft["fields"],
    birthDate: user.birth_date ?? "",
    interests: [...user.interests],
    newInterest: "",
    verified: !!user.student_verified_at,
    role: user.role_access,
  };
}

export function hasUserEdits(user: UserRecord, draft: UserEditDraft): boolean {
  const original = createUserEditDraft(user);
  return USER_EDIT_FIELDS.some((field) => draft.fields[field] !== original.fields[field]) ||
    draft.birthDate !== original.birthDate || JSON.stringify(draft.interests) !== JSON.stringify(original.interests) ||
    !!draft.newInterest.trim() || draft.verified !== original.verified || draft.role !== original.role || draft.photo !== undefined;
}

/** Validate the complete draft before sending any mutations. */
export function userEditChanges(user: UserRecord, draft: UserEditDraft, membershipTypes: MembershipTypeOption[]) {
  const original = createUserEditDraft(user);
  const changes: Record<string, string | number | boolean | string[] | null> = {};
  for (const field of USER_EDIT_FIELDS) {
    if (draft.fields[field] === original.fields[field]) continue;
    const value = draft.fields[field];
    if (field === "first_name" || field === "last_name") {
      if (!value.trim()) throw new Error(`${field === "first_name" ? "First" : "Last"} name is required.`);
      changes[field] = value.trim();
    } else if (field === "newsletter") changes[field] = value === "true";
    else if (field === "student_number") {
      if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error("Enter a valid student number.");
      changes[field] = value ? Number(value) : null;
    } else if (field === "membership_type_id") changes[field] = value || null;
    else if (field === "year") {
      if (value && !["1", "2", "3", "4", "5+"].includes(value)) throw new Error("Invalid university year.");
      changes[field] = value || null;
    } else if (field === "school_institution") {
      // A school draft may remain after switching away from Non-UBC; omit the locked field.
      if (!canEditUserSchool(user, draft.fields.membership_type_id, membershipTypes)) continue;
      changes[field] = value.trim() || null;
    } else changes[field] = value;
  }
  if (draft.birthDate !== original.birthDate) changes.birth_date = validateBirthDate(draft.birthDate);
  const interests = normalizeInterests([...draft.interests, ...(draft.newInterest.trim() ? [draft.newInterest] : [])]);
  if (JSON.stringify(interests) !== JSON.stringify(original.interests)) changes.interests = interests;
  return changes;
}
