"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import { getConfirmedSignInEmail } from "@/lib/auth/current-user";
import { errorFields, log } from "@/lib/log";
import { adminUpdateUserInfoById } from "@/lib/supabase-helpers/admin-server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";
import { releaseStaleUbcEmailHolds } from "@/lib/supabase-helpers/ubc-verification";
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
import { validateStudentNumber } from "./lib/validation";
import {
  buildEligibilityUpdate,
  canEditMembershipClassification,
  userTypeConfirmation,
} from "./lib/policy";
import {
  hasPurchaseUbcVerification,
  normalizeUbcEmail,
  ubcAudienceForUserType,
  ubcEmailQualifies,
  validateUbcEmail,
  type UbcAudience,
  type UbcSendResult,
  type UbcVerifyResult,
} from "./lib/ubc-verification";
import { sendUbcCode, verifyUbcCode } from "./ubc-verification-server";

const UBC_EMAIL_TAKEN =
  "This UBC email is already verified on another account. Contact a UX Hub exec.";

class UbcEmailTakenError extends Error {}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}

/**
 * The stamp a save writes when the address is the member's confirmed sign-in
 * email: that already proves it, so no code is sent. Written in the same
 * update as the address, which is what keeps `scrub_ubc_verification` from
 * clearing it.
 */
async function signInEmailStamp(
  userId: string,
  ubcEmail: string | null | undefined,
  audience: UbcAudience,
): Promise<Pick<UserInfoUpdate, "ubc_verified_at" | "ubc_verified_via" | "ubc_verified_by"> | null> {
  if (!ubcEmail) return null;
  const confirmed = await getConfirmedSignInEmail();
  if (!confirmed || normalizeUbcEmail(confirmed) !== ubcEmail) return null;
  if (!ubcEmailQualifies(ubcEmail, audience)) return null;

  await releaseStaleUbcEmailHolds(supabaseAdmin, { email: ubcEmail, userId });
  return {
    ubc_verified_at: new Date().toISOString(),
    ubc_verified_via: "sign_in_email",
    ubc_verified_by: null,
  };
}

/** Writes a profile update, turning the one-verified-account index into a message. */
async function writeProfile(userId: string, update: UserInfoUpdate) {
  try {
    const rows = await adminUpdateUserInfoById(userId, update);
    return (rows?.[0] ?? null) as UserInfoRow | null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new UbcEmailTakenError(UBC_EMAIL_TAKEN);
    throw error;
  }
}

interface UpdateEligibilityInput {
  userType: UserType;
  studentNumber?: string | null;
  faculty?: string | null;
  /**
   * A new UBC address, checked against the type's domain rule. Left out, a
   * type change keeps the saved address only while it still qualifies, and a
   * qualifying confirmed sign-in email fills an empty one.
   */
  ubcEmail?: string | null;
}

/**
 * Settings › Profile's eligibility save. Never sends a code: the next join
 * asks for one. Changing the type or the address clears the verification
 * (the database trigger), unless the address is the confirmed sign-in email,
 * which is stamped again.
 */
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

  const audience = ubcAudienceForUserType(input.userType);
  let ubcEmail: string | null | undefined;
  let stamp: Awaited<ReturnType<typeof signInEmailStamp>> = null;
  if (audience) {
    if (input.ubcEmail !== undefined) {
      ubcEmail = input.ubcEmail ? normalizeUbcEmail(input.ubcEmail) : null;
      if (ubcEmail) {
        const error = validateUbcEmail(ubcEmail, audience);
        if (error) throw new Error(error);
      }
    } else if (input.userType !== user.user_type) {
      ubcEmail = ubcEmailQualifies(user.ubc_email, audience) ? user.ubc_email : null;
    }

    const effective = ubcEmail !== undefined ? ubcEmail : user.ubc_email;
    if (!effective) {
      const confirmed = await getConfirmedSignInEmail();
      if (confirmed && ubcEmailQualifies(confirmed, audience)) {
        ubcEmail = normalizeUbcEmail(confirmed);
      }
    }
    stamp = await signInEmailStamp(
      user.id,
      ubcEmail !== undefined ? ubcEmail : user.ubc_email,
      audience,
    );
  }

  await writeProfile(user.id, {
    ...buildEligibilityUpdate({
      userType: input.userType,
      studentNumber,
      faculty: input.faculty,
      ubcEmail,
    }),
    ...(stamp ?? {}),
    ...userTypeConfirmation(),
  });
  if (stamp) log.info("ubc_verification.verified", { userId: user.id, via: "sign_in_email" });
}

export type MembershipProfileInput =
  | {
      audience: "student";
      faculty: string;
      major: string;
      studentNumber: string;
      year: UniversityYear;
      ubcEmail: string;
    }
  | {
      audience: "faculty";
      faculty: string;
      ubcEmail: string;
    }
  | {
      audience: "non-ubc";
      schoolInstitution: string;
      studentStatus: StudentStatus | "";
      year: UniversityYear | "";
    };

/**
 * `verified`: nothing more to prove (Non-UBC, the sign-in email, or a
 * verification still valid on this account), so the flow continues. `code`:
 * the details step stays open for the code sent to `email`; a failed send
 * never fails the save, it shows in `send`.
 */
export type MembershipProfileResult =
  | { ok: true; verification: "verified" }
  | { ok: true; verification: "code"; email: string; send: UbcSendResult }
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
      return {
        ok: false,
        error:
          "Your membership classification cannot be changed while a membership is active or pending.",
      };
    }

    let update: UserInfoUpdate;
    let audience: UbcAudience | null = null;
    let ubcEmail: string | null = null;

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
      audience = "student";
      ubcEmail = normalizeUbcEmail(input.ubcEmail ?? "");
      const emailError = validateUbcEmail(ubcEmail, audience);
      if (emailError) return { ok: false, error: emailError };
      update = {
        user_type: "ubcStudent",
        student_number: Number(input.studentNumber),
        faculty: input.faculty,
        year: input.year,
        major: input.major.trim(),
        ubc_email: ubcEmail,
        faculty_email: null,
        school_institution: null,
        student_status: null,
        ...userTypeConfirmation(),
      };
    } else if (input.audience === "faculty") {
      audience = "faculty";
      ubcEmail = normalizeUbcEmail(input.ubcEmail ?? "");
      const emailError = validateUbcEmail(ubcEmail, audience);
      if (emailError) return { ok: false, error: emailError };
      if (
        input.faculty &&
        !FACULTIES.includes(input.faculty as (typeof FACULTIES)[number])
      ) {
        return { ok: false, error: "Select a valid faculty." };
      }
      update = {
        user_type: "faculty",
        ubc_email: ubcEmail,
        // Read by the code in production until the cleanup migration.
        faculty_email: ubcEmail,
        faculty: optionalText(input.faculty),
        student_number: null,
        major: null,
        year: null,
        school_institution: null,
        student_status: null,
        ...userTypeConfirmation(),
      };
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
      update = {
        user_type: "nonUbc",
        school_institution: optionalText(input.schoolInstitution),
        student_status: input.studentStatus || null,
        year: input.year || null,
        ubc_email: null,
        faculty_email: null,
        student_number: null,
        faculty: null,
        major: null,
        ...userTypeConfirmation(),
      };
    } else {
      return { ok: false, error: "Select a valid membership classification." };
    }

    const stamp = audience ? await signInEmailStamp(user.id, ubcEmail, audience) : null;
    let saved: UserInfoRow | null;
    try {
      saved = await writeProfile(user.id, { ...update, ...(stamp ?? {}) });
    } catch (error) {
      if (error instanceof UbcEmailTakenError) return { ok: false, error: error.message };
      throw error;
    }

    revalidatePath("/portal/membership");
    if (!audience || !ubcEmail) return { ok: true, verification: "verified" };
    if (stamp) {
      log.info("ubc_verification.verified", { userId: user.id, via: "sign_in_email" });
      revalidatePath("/admin/users", "layout");
      return { ok: true, verification: "verified" };
    }
    if (saved && hasPurchaseUbcVerification(saved)) {
      return { ok: true, verification: "verified" };
    }

    const send = await sendUbcCode({ audience, email: ubcEmail, userId: user.id });
    if (send.status === "already_verified") return { ok: true, verification: "verified" };
    return { ok: true, verification: "code", email: ubcEmail, send };
  } catch (error) {
    log.error("membership.profile_save_failed", errorFields(error));
    return {
      ok: false,
      error: "Your membership details could not be saved. Please try again.",
    };
  }
}

/** The details step's "Resend code" / "Send a new code", for the saved address. */
export async function sendUbcCodeAction(): Promise<UbcSendResult> {
  const user = await requireAuth("/portal/membership/join");
  const audience = ubcAudienceForUserType(user.user_type);
  if (!audience || !user.ubc_email) return { status: "send_failed" };
  if (hasPurchaseUbcVerification(user)) return { status: "already_verified" };
  return sendUbcCode({ audience, email: user.ubc_email, userId: user.id });
}

/** The details step's Verify, for the code sent to the saved address. */
export async function verifyUbcCodeAction(code: string): Promise<UbcVerifyResult> {
  const user = await requireAuth("/portal/membership/join");
  if (!ubcAudienceForUserType(user.user_type)) return { status: "none" };
  const result = await verifyUbcCode({
    email: user.ubc_email,
    input: code,
    userId: user.id,
  });
  if (result.status === "verified") {
    revalidatePath("/portal/membership");
    revalidatePath("/admin/users", "layout");
  }
  return result;
}
