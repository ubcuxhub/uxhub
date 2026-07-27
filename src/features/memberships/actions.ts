"use server";

import { requireAuth } from "@/lib/auth/guards";
import { adminUpdateUserInfoById } from "@/lib/supabase-helpers/admin-server";
import type { UserType } from "@/types/models";

const STUDENT_NUMBER_PATTERN = /^\d{8}$/;
const UBC_EMAIL_PATTERN = /^[^\s@]+@([a-z0-9-]+\.)*ubc\.ca$/i;

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

  if (user.membership_type_id || user.membership_pre_ordered_type_id) {
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
    if (!STUDENT_NUMBER_PATTERN.test(rawStudentNumber)) {
      throw new Error("Student number must be 8 digits.");
    }
    studentNumber = Number(rawStudentNumber);
  }

  if (
    input.userType === "faculty" &&
    (!UBC_EMAIL_PATTERN.test(input.facultyEmail?.trim() ?? "") ||
      input.facultyEmail?.trim().toLowerCase() !== user.email.toLowerCase())
  ) {
    throw new Error(
      "Faculty eligibility requires signing in with the same UBC email address."
    );
  }

  await adminUpdateUserInfoById(user.id, {
    user_type: input.userType,
    student_number: studentNumber,
    faculty: input.userType === "faculty" ? input.faculty?.trim() || null : null,
  });
}
