import type { AutosaveState } from "@/features/applications/lib/autosave";
import {
  getEffectiveMembershipExpiry,
  hasActiveMembership,
} from "@/features/memberships/lib/expiry";
import { validateStudentNumber } from "@/features/memberships/lib/validation";
import { isDietaryEmpty, type DietaryValue } from "@/features/setup/components/DietaryFields";
import type { AvatarChoice } from "@/features/setup/components/AvatarPicker";
import type { AvatarPreset, InterestId } from "@/features/setup/lib/options";
import { toSetupStep } from "@/features/setup/lib/state";
import type { DietaryNeeds } from "@/features/setup/lib/validation";
import { formatEventDate } from "@/lib/date";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
  UserType,
} from "@/lib/supabase/models";

/**
 * The parts of the Profile tab that save on their own. Each has its own
 * autosave status beside its heading, so two sections saving at once never
 * overwrite each other's "Saved", and a failure shows next to what failed.
 */
export type ProfileSectionId = "photo" | "about" | "studies" | "dietary" | "interests";

export type ProfileSaveStates = Partial<Record<ProfileSectionId, AutosaveState>>;

/** The editable profile text and select fields, as the inputs hold them. */
export interface ProfileFormData {
  first_name: string;
  last_name: string;
  preferred_pronouns: string;
  phone: string;
  student_number: string;
  faculty: string;
  major: string;
  school_institution: string;
  student_status: StudentStatus | "";
  year: UniversityYear | "";
}

export function toProfileForm(user: UserInfoRow): ProfileFormData {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    preferred_pronouns: user.preferred_pronouns ?? "",
    phone: user.phone ?? "",
    student_number: user.student_number?.toString() ?? "",
    faculty: user.faculty ?? "",
    major: user.major ?? "",
    school_institution: user.school_institution ?? "",
    student_status: user.student_status ?? "",
    year: user.year ?? "",
  };
}

/** The fields whose errors wait for blur (§3.2). */
export type CheckedField = "first_name" | "last_name" | "student_number";

export type ProfileErrors = Record<CheckedField, string | null>;

/** About you: the fields `updateUserInfoById` writes for every account type. */
export const ABOUT_FIELDS = ["first_name", "last_name", "preferred_pronouns", "phone"] as const;

/** Studies: the eligibility columns each account type owns and edits here. */
export const STUDIES_FIELDS: Record<UserType, ReadonlyArray<keyof ProfileFormData>> = {
  ubcStudent: ["faculty", "major", "year", "student_number"],
  faculty: ["faculty"],
  nonUbc: ["school_institution", "student_status", "year"],
};

export type AboutValues = Pick<ProfileFormData, (typeof ABOUT_FIELDS)[number]>;
export type StudiesValues = Partial<ProfileFormData>;

export function pickFields<K extends keyof ProfileFormData>(
  form: ProfileFormData,
  fields: readonly K[],
): Pick<ProfileFormData, K> {
  const picked = {} as Pick<ProfileFormData, K>;
  for (const field of fields) picked[field] = form[field];
  return picked;
}

export function sameFields(a: Partial<ProfileFormData>, b: Partial<ProfileFormData>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ProfileFormData>;
  for (const key of keys) if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  return true;
}

/** Which section a form field saves with. */
export function sectionOf(field: keyof ProfileFormData): "about" | "studies" {
  return (ABOUT_FIELDS as readonly string[]).includes(field) ? "about" : "studies";
}

/**
 * Says what is wrong with a typed student number. The membership validator's
 * format message only says "valid", so the length is checked here first.
 */
export function studentNumberError(value: string): string | null {
  if (!value.trim()) return "Enter your 8-digit student number.";
  if (!/^\d{8}$/.test(value.trim())) return "Student numbers are 8 digits.";
  return validateStudentNumber(value);
}

/**
 * Every field error, shown or not. A student number is only checked while
 * it can be edited and differs from the saved one, so an account holding an
 * old, oddly formatted number doesn't open on a red field or hold the rest of
 * its studies.
 */
export function profileErrors(
  form: ProfileFormData,
  context: { userType: UserType; canEditEligibility: boolean; savedStudentNumber: string },
): ProfileErrors {
  return {
    first_name: form.first_name.trim() ? null : "Enter your first name.",
    last_name: form.last_name.trim() ? null : "Enter your last name.",
    student_number:
      context.userType === "ubcStudent" &&
      context.canEditEligibility &&
      form.student_number !== context.savedStudentNumber
        ? studentNumberError(form.student_number)
        : null,
  };
}

/** Whether the section can save as typed. Invalid input holds only its own section. */
export function sectionBlocked(section: "about" | "studies", errors: ProfileErrors): boolean {
  return section === "about"
    ? Boolean(errors.first_name || errors.last_name)
    : Boolean(errors.student_number);
}

/** Dietary needs as last saved, and whether the member has answered at all. */
export interface SavedDietary {
  needs: DietaryNeeds;
  answered: boolean;
}

/** "about" and "dietary" are the setup steps before dietary needs are answered. */
export function dietaryAnswered(user: Pick<UserInfoRow, "setup_step">): boolean {
  return !["about", "dietary"].includes(toSetupStep(user.setup_step));
}

export function savedDietaryOf(user: UserInfoRow): SavedDietary {
  return {
    needs: {
      diets: user.diets as DietaryNeeds["diets"],
      allergies: user.allergies as DietaryNeeds["allergies"],
      otherAllergies: user.other_allergies,
    },
    answered: dietaryAnswered(user),
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * What the dietary section should send, or null when it is saved. Text typed
 * into Other allergies isn't a change until it's added. Choosing "I don't
 * have any dietary needs" on an unanswered profile is a change even though
 * the lists stay empty: it is the answer.
 */
export function dietaryPayload(value: DietaryValue, saved: SavedDietary): DietaryNeeds | null {
  const needs: DietaryNeeds = {
    diets: value.diets,
    allergies: value.allergies,
    otherAllergies: value.otherAllergies,
  };
  const same =
    sameSet(needs.diets, saved.needs.diets) &&
    sameSet(needs.allergies, saved.needs.allergies) &&
    sameSet(needs.otherAllergies, saved.needs.otherAllergies);
  if (same && (saved.answered || !value.none)) return null;
  return needs;
}

export function isDietaryUnanswered(value: DietaryValue): boolean {
  return !value.none && isDietaryEmpty(value);
}

/** The interests to send, or null when the same set is saved. */
export function interestsPayload(value: InterestId[], saved: InterestId[]): InterestId[] | null {
  return sameSet(value, saved) ? null : value;
}

export function avatarChoiceOf(user: Pick<UserInfoRow, "profile_photo_path" | "avatar_preset">): AvatarChoice {
  if (user.profile_photo_path) return { kind: "photo" };
  if (user.avatar_preset) return { kind: "preset", preset: user.avatar_preset as AvatarPreset };
  return null;
}

/**
 * The preset to save, or null when there is nothing to send. Choosing your
 * uploaded photo needs no write: it is already what shows, since an upload
 * replaces any preset when it is stored.
 */
export function photoPayload(choice: AvatarChoice, savedPreset: AvatarPreset | null): AvatarPreset | null {
  if (choice?.kind !== "preset") return null;
  return choice.preset === savedPreset ? null : choice.preset;
}

/** Where the member stands with membership, as the header badge says it. */
export type MembershipSummary =
  | { kind: "active"; name: string | null; expiresOn: string | null }
  | { kind: "pending" }
  | { kind: "ended"; name: string | null; endedOn: string | null }
  | { kind: "none" };

/**
 * A pre-order counts as pending even without a membership: it locks the
 * eligibility fields like an active membership does, so the header has to say
 * so or the lock reads as a bug. A lapsed membership keeps its type id, so
 * "ended" is told apart from "active" by the effective expiry.
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
  // Effective date, not the raw column: a club-wide term end can cut a
  // membership short, and this is where members check it.
  const date = formatEventDate(getEffectiveMembershipExpiry(user, termEndsAt), {
    month: "short",
  });
  if (!hasActiveMembership(user, termEndsAt)) {
    return { kind: "ended", name: membershipName, endedOn: date };
  }
  return { kind: "active", name: membershipName, expiresOn: date };
}

export function membershipLabel(summary: MembershipSummary): string {
  if (summary.kind === "pending") return "Payment processing";
  if (summary.kind === "none") return "Not a member";
  if (summary.kind === "ended") return "Membership ended";
  return summary.name ? `${summary.name} member` : "Member";
}

/** The Account section's Membership row: the badge plus its date. */
export function membershipDetail(summary: MembershipSummary): string {
  if (summary.kind === "active" && summary.expiresOn) {
    return `${membershipLabel(summary)}, until ${summary.expiresOn}`;
  }
  if (summary.kind === "ended") {
    const name = summary.name ? `${summary.name} membership` : "Membership";
    return summary.endedOn ? `${name} ended ${summary.endedOn}` : `${name} ended`;
  }
  return membershipLabel(summary);
}

/** Why the student number can't be edited, said where the member looks. */
export function lockedEligibilityNote(summary: MembershipSummary): string {
  return summary.kind === "pending"
    ? "Locked while your membership payment is processing. Ask an exec to change it."
    : "Locked while your membership is active. Ask an exec to change it.";
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
