"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
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

interface UpdateEligibilityInput {
  userType: UserType;
  studentNumber?: string | null;
  faculty?: string | null;
  facultyEmail?: string | null;
}

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

export async function updateEligibilityProfileAction(
  input: UpdateEligibilityInput
) {
  const user = await requireAuth();
  const termEndsAt = await fetchMembershipTermEndsAt(await createClient());
  if (!canEditMembershipClassification(user, termEndsAt)) {
    throw new Error(
      "Eligibility details cannot be changed while a membership is active."
    );
  }
  if (!["ubcStudent", "faculty", "nonUbc"].includes(input?.userType)) {
    throw new Error("Invalid user type.");
  }
  // The same faculty list membership join checks; Settings offers it as a
  // select, so anything else didn't come from the form.
  const faculty = input.faculty;
  if (
    faculty != null &&
    (typeof faculty !== "string" ||
      (faculty.trim() !== "" && !isFaculty(faculty.trim())))
  ) {
    throw new Error("Select a valid faculty.");
  }

  let studentNumber: number | null = null;
  if (input.userType === "ubcStudent") {
    const rawStudentNumber =
      typeof input.studentNumber === "string" ? input.studentNumber.trim() : "";
    const error = validateStudentNumber(rawStudentNumber);
    if (error) throw new Error(error);
    studentNumber = Number(rawStudentNumber);
  }
  // Faculty eligibility is proved by the signed-in address, so the validated
  // value is also what gets stored — leaving it unwritten would strand the
  // profile as incomplete.
  let facultyEmail: string | undefined;
  if (input.userType === "faculty") {
    const normalized =
      typeof input.facultyEmail === "string"
        ? input.facultyEmail.trim().toLowerCase()
        : "";
    if (
      validateFacultyEmail(normalized) ||
      normalized !== user.email.toLowerCase()
    ) {
      throw new Error(
        "Faculty eligibility requires signing in with the same UBC email address."
      );
    }
    facultyEmail = normalized;
  }

  const saved = await writeEligibility(
    user,
    buildEligibilityUpdate({
      userType: input.userType,
      studentNumber,
      faculty,
      facultyEmail,
    }),
  );
  if (!saved) throw new Error(CLASSIFICATION_LOCKED_MESSAGE);
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

export type MembershipProfileResult =
  | { ok: true }
  | { ok: false; error: string };

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export async function saveMembershipProfileAction(
  input: MembershipProfileInput
): Promise<MembershipProfileResult> {
  const user = await requireAuth("/portal/membership/join");

  try {
    const termEndsAt = await fetchMembershipTermEndsAt(await createClient());
    if (!canEditMembershipClassification(user, termEndsAt)) {
      return { ok: false, error: CLASSIFICATION_LOCKED_MESSAGE };
    }

    let saved: boolean;

    if (input.audience === "student") {
      const numberError = validateStudentNumber(input.studentNumber);
      if (numberError) return { ok: false, error: numberError };
      if (!FACULTIES.includes(input.faculty as (typeof FACULTIES)[number])) {
        return { ok: false, error: "Select a valid faculty." };
      }
      if (!YEAR_LEVELS.includes(input.year)) {
        return { ok: false, error: "Select a valid year." };
      }
      if (!input.major.trim()) {
        return { ok: false, error: "Enter your major." };
      }
      saved = await writeEligibility(user, {
        user_type: "ubcStudent",
        student_number: Number(input.studentNumber),
        faculty: input.faculty,
        year: input.year,
        major: input.major.trim(),
        faculty_email: null,
        school_institution: null,
        student_status: null,
      });
    } else if (input.audience === "faculty") {
      const normalizedEmail = input.facultyEmail.trim().toLowerCase();
      const emailError = validateFacultyEmail(normalizedEmail);
      if (emailError) return { ok: false, error: emailError };
      if (normalizedEmail !== user.email.toLowerCase()) {
        return {
          ok: false,
          error:
            "Faculty eligibility requires signing in with the same UBC email address.",
        };
      }
      if (
        input.faculty &&
        !FACULTIES.includes(input.faculty as (typeof FACULTIES)[number])
      ) {
        return { ok: false, error: "Select a valid faculty." };
      }
      saved = await writeEligibility(user, {
        user_type: "faculty",
        faculty_email: normalizedEmail,
        faculty: optionalText(input.faculty),
        student_number: null,
        major: null,
        year: null,
        school_institution: null,
        student_status: null,
      });
    } else if (input.audience === "non-ubc") {
      const validStatuses: StudentStatus[] = [
        "undergraduate",
        "graduate",
        "other",
      ];
      if (
        input.studentStatus &&
        !validStatuses.includes(input.studentStatus)
      ) {
        return { ok: false, error: "Select a valid student status." };
      }
      if (input.year && !YEAR_LEVELS.includes(input.year)) {
        return { ok: false, error: "Select a valid year." };
      }
      saved = await writeEligibility(user, {
        user_type: "nonUbc",
        school_institution: optionalText(input.schoolInstitution),
        student_status: input.studentStatus || null,
        year: input.year || null,
        faculty_email: null,
        student_number: null,
        faculty: null,
        major: null,
      });
    } else {
      return { ok: false, error: "Select a valid membership classification." };
    }
    if (!saved) {
      log.warn("membership.profile_save_refused", { userId: user.id });
      return { ok: false, error: CLASSIFICATION_LOCKED_MESSAGE };
    }

    revalidatePath("/portal/membership");
    return { ok: true };
  } catch (error) {
    log.error("membership.profile_save_failed", errorFields(error));
    return {
      ok: false,
      error: "Your membership details could not be saved. Please try again.",
    };
  }
}
