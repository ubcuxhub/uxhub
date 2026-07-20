"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { FACULTIES, YEAR_LEVELS } from "@/lib/constants";
import type { StudentStatus, UniversityYear } from "@/types/models";
import { validateFacultyEmail, validateStudentNumber } from "./lib/validation";
import { canEditMembershipClassification } from "./lib/policy";

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
  input: MembershipProfileInput,
): Promise<MembershipProfileResult> {
  try {
    const user = await requireAuth("/portal/membership/join");
    if (!canEditMembershipClassification(user)) {
      return {
        ok: false,
        error: "Your membership classification cannot be changed while a membership is active or pending.",
      };
    }

    const supabase = await createClient();

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

      await updateUserInfoById(supabase, user.id, {
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
      const emailError = validateFacultyEmail(input.facultyEmail);
      if (emailError) return { ok: false, error: emailError };
      if (
        input.faculty &&
        !FACULTIES.includes(input.faculty as (typeof FACULTIES)[number])
      ) {
        return { ok: false, error: "Select a valid faculty." };
      }

      await updateUserInfoById(supabase, user.id, {
        user_type: "faculty",
        faculty_email: input.facultyEmail.trim().toLowerCase(),
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

      await updateUserInfoById(supabase, user.id, {
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
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Your membership details could not be saved.",
    };
  }
}
