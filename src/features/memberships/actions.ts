"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { fetchLiveMembershipPurchase } from "@/lib/supabase-helpers/purchases";
import { updateUserTypeIfMembershipUnchanged } from "@/lib/supabase-helpers/setup";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import type {
  StudentStatus,
  UniversityYear,
  UserInfoRow,
  UserInfoUpdate,
  UserType,
} from "@/lib/supabase/models";
import { validateFacultyEmail, validateStudentNumber } from "./lib/validation";
import {
  buildEligibilityUpdate,
  canEditMembershipClassification,
  userTypeConfirmation,
} from "./lib/policy";

export type MembershipProfileResult =
  | { ok: true }
  | { ok: false; error: string };

type ClassificationCheck =
  | { ok: true; update: UserInfoUpdate }
  | { ok: false; error: string };

const USER_TYPES: readonly UserType[] = ["ubcStudent", "faculty", "nonUbc"];
const STUDENT_STATUSES: readonly StudentStatus[] = ["undergraduate", "graduate", "other"];

const CLASSIFICATION_LOCKED_MESSAGE =
  "Your membership classification cannot be changed while a membership is active or pending.";

function isFaculty(value: string) {
  return FACULTIES.includes(value as (typeof FACULTIES)[number]);
}

/**
 * Writes eligibility columns only while the membership the caller checked is
 * still the one on the row (see `updateUserTypeIfMembershipUnchanged`), so a
 * checkout or webhook landing between the check and the write can't leave a
 * membership sold for one `user_type` on a row that says another. False when
 * the membership changed in between.
 */
async function writeEligibility(
  user: UserInfoRow,
  patch: UserInfoUpdate,
): Promise<boolean> {
  return (
    (await updateUserTypeIfMembershipUnchanged(supabaseAdmin, user, {
      ...patch,
      ...userTypeConfirmation(),
    })) !== null
  );
}

/**
 * Why the classification can't change now, or null: a membership is active,
 * or a membership payment is still in flight (its tier was chosen for the
 * current classification).
 */
async function classificationLockedError(user: UserInfoRow) {
  const supabase = await createClient();
  const termEndsAt = await fetchMembershipTermEndsAt(supabase);
  if (!canEditMembershipClassification(user, termEndsAt)) {
    return CLASSIFICATION_LOCKED_MESSAGE;
  }
  if (await fetchLiveMembershipPurchase(supabase, user.id)) {
    return "Your membership classification cannot be changed while a membership payment is processing.";
  }
  return null;
}

/**
 * The one validation of a classification's eligibility fields, shared by the
 * join flow and Settings, and the update it writes: `buildEligibilityUpdate`
 * sets what the classification owns and clears the rest. Inputs come from the
 * client, so their types are checked too.
 */
function checkClassification(
  user: Pick<UserInfoRow, "email">,
  input: {
    userType: unknown;
    studentNumber?: unknown;
    faculty?: unknown;
    facultyEmail?: unknown;
  }
): ClassificationCheck {
  const userType = input.userType as UserType;
  if (!USER_TYPES.includes(userType)) {
    return { ok: false, error: "Select a valid membership classification." };
  }

  // The same faculty list everywhere; the forms offer it as a select, so
  // anything else didn't come from them.
  const faculty = input.faculty;
  if (
    faculty != null &&
    (typeof faculty !== "string" ||
      (faculty.trim() !== "" && !isFaculty(faculty.trim())))
  ) {
    return { ok: false, error: "Select a valid faculty." };
  }

  let studentNumber: number | null = null;
  if (userType === "ubcStudent") {
    const raw = typeof input.studentNumber === "string" ? input.studentNumber.trim() : "";
    const error = validateStudentNumber(raw);
    if (error) return { ok: false, error };
    studentNumber = Number(raw);
  }

  // Faculty eligibility is proved by the signed-in address, so the validated
  // value is also what gets stored — leaving it unwritten would strand the
  // profile as incomplete.
  let facultyEmail: string | undefined;
  if (userType === "faculty") {
    const normalized =
      typeof input.facultyEmail === "string" ? input.facultyEmail.trim().toLowerCase() : "";
    const emailError = validateFacultyEmail(normalized);
    if (emailError) return { ok: false, error: emailError };
    if (normalized !== user.email.toLowerCase()) {
      return {
        ok: false,
        error: "Faculty eligibility requires signing in with the same UBC email address.",
      };
    }
    facultyEmail = normalized;
  }

  return {
    ok: true,
    update: buildEligibilityUpdate({
      userType,
      studentNumber,
      faculty: faculty === undefined ? undefined : (faculty as string | null),
      facultyEmail,
    }),
  };
}

/**
 * Saves a checked classification, or says why not. Shared by both actions so
 * they refuse, write and revalidate the same way.
 */
async function saveClassification(
  user: UserInfoRow,
  check: (user: UserInfoRow) => ClassificationCheck,
  failedEvent: string,
): Promise<MembershipProfileResult> {
  try {
    const locked = await classificationLockedError(user);
    if (locked) return { ok: false, error: locked };

    const checked = check(user);
    if (!checked.ok) return checked;

    if (!(await writeEligibility(user, checked.update))) {
      log.warn("membership.profile_save_refused", { userId: user.id });
      return { ok: false, error: CLASSIFICATION_LOCKED_MESSAGE };
    }

    revalidatePath("/portal/membership");
    return { ok: true };
  } catch (error) {
    log.error(failedEvent, errorFields(error));
    return {
      ok: false,
      error: "Your membership details could not be saved. Please try again.",
    };
  }
}

interface UpdateEligibilityInput {
  userType: UserType;
  studentNumber?: string | null;
  faculty?: string | null;
  facultyEmail?: string | null;
}

/** Settings' eligibility edit: the classification and its student number. */
export async function updateEligibilityProfileAction(
  input: UpdateEligibilityInput
): Promise<MembershipProfileResult> {
  const user = await requireAuth();
  return saveClassification(
    user,
    (current) => checkClassification(current, input ?? { userType: null }),
    "membership.eligibility_save_failed",
  );
}

export type MembershipProfileInput =
  | {
      audience: "student";
      faculty: string;
      major: string;
      studentNumber: string;
      year: UniversityYear;
    }
  | {
      audience: "faculty";
      faculty: string;
      facultyEmail: string;
    }
  | {
      audience: "non-ubc";
      schoolInstitution: string;
      studentStatus: StudentStatus | "";
      year: UniversityYear | "";
    };

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

/**
 * The join flow's details: the shared eligibility check, plus the columns
 * only this form collects (major, year, school, student status).
 */
function checkMembershipProfile(
  user: Pick<UserInfoRow, "email">,
  input: MembershipProfileInput
): ClassificationCheck {
  if (input.audience === "student") {
    if (!isFaculty(input.faculty)) {
      return { ok: false, error: "Select a valid faculty." };
    }
    if (!YEAR_LEVELS.includes(input.year)) {
      return { ok: false, error: "Select a valid year." };
    }
    if (!input.major.trim()) {
      return { ok: false, error: "Enter your major." };
    }
    const checked = checkClassification(user, {
      userType: "ubcStudent",
      studentNumber: input.studentNumber,
      faculty: input.faculty,
    });
    if (!checked.ok) return checked;
    return {
      ok: true,
      update: { ...checked.update, year: input.year, major: input.major.trim() },
    };
  }

  if (input.audience === "faculty") {
    return checkClassification(user, {
      userType: "faculty",
      faculty: input.faculty,
      facultyEmail: input.facultyEmail,
    });
  }

  if (input.audience === "non-ubc") {
    if (input.studentStatus && !STUDENT_STATUSES.includes(input.studentStatus)) {
      return { ok: false, error: "Select a valid student status." };
    }
    if (input.year && !YEAR_LEVELS.includes(input.year)) {
      return { ok: false, error: "Select a valid year." };
    }
    const checked = checkClassification(user, { userType: "nonUbc" });
    if (!checked.ok) return checked;
    return {
      ok: true,
      update: {
        ...checked.update,
        school_institution: optionalText(input.schoolInstitution),
        student_status: input.studentStatus || null,
        year: input.year || null,
      },
    };
  }

  return { ok: false, error: "Select a valid membership classification." };
}

export async function saveMembershipProfileAction(
  input: MembershipProfileInput
): Promise<MembershipProfileResult> {
  const user = await requireAuth("/portal/membership/join");
  return saveClassification(
    user,
    (current) => checkMembershipProfile(current, input),
    "membership.profile_save_failed",
  );
}
