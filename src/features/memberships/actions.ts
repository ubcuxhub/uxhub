"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { adminUpdateUserInfoById } from "@/lib/supabase-helpers/admin-server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { createClient } from "@/lib/supabase/server";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import type {
  StudentStatus,
  UniversityYear,
  UserType,
} from "@/types/models";
import { validateFacultyEmail, validateStudentNumber } from "./lib/validation";
import {
  DUPLICATE_STUDENT_NUMBER_MESSAGE,
  isDuplicateStudentNumberError,
} from "./lib/errors";
import {
  buildEligibilityUpdate,
  canEditMembershipClassification,
} from "./lib/policy";

interface UpdateEligibilityInput {
  userType: UserType;
  studentNumber?: string | null;
  faculty?: string | null;
  facultyEmail?: string | null;
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
  if (!["ubcStudent", "faculty", "nonUbc"].includes(input.userType)) {
    throw new Error("Invalid user type.");
  }

  let studentNumber: number | null = null;
  if (input.userType === "ubcStudent") {
    const rawStudentNumber = input.studentNumber?.trim() ?? "";
    const error = validateStudentNumber(rawStudentNumber);
    if (error) throw new Error(error);
    studentNumber = Number(rawStudentNumber);
  }
  if (
    input.userType === "faculty" &&
    (validateFacultyEmail(input.facultyEmail?.trim() ?? "") ||
      input.facultyEmail?.trim().toLowerCase() !== user.email.toLowerCase())
  ) {
    throw new Error(
      "Faculty eligibility requires signing in with the same UBC email address."
    );
  }

  try {
    await adminUpdateUserInfoById(
      user.id,
      buildEligibilityUpdate({
        userType: input.userType,
        studentNumber,
        faculty: input.faculty,
      }),
    );
  } catch (error) {
    if (isDuplicateStudentNumberError(error)) {
      throw new Error(DUPLICATE_STUDENT_NUMBER_MESSAGE);
    }
    throw error;
  }
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
  try {
    const user = await requireAuth("/portal/membership/join");
    const termEndsAt = await fetchMembershipTermEndsAt(await createClient());
    if (!canEditMembershipClassification(user, termEndsAt)) {
      return {
        ok: false,
        error:
          "Your membership classification cannot be changed while a membership is active or pending.",
      };
    }

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
      await adminUpdateUserInfoById(user.id, {
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
      await adminUpdateUserInfoById(user.id, {
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
      await adminUpdateUserInfoById(user.id, {
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

    revalidatePath("/portal/membership");
    return { ok: true };
  } catch (error) {
    if (isDuplicateStudentNumberError(error)) {
      return { ok: false, error: DUPLICATE_STUDENT_NUMBER_MESSAGE };
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Your membership details could not be saved.",
    };
  }
}
