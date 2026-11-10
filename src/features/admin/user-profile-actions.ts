"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { TABLES } from "@/lib/supabase-helpers/tables";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { replaceProfilePhoto, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";
import { normalizeInterests, validateBirthDate } from "./lib/user-profile";

export async function saveUserBirthDateAction(userId: string, value: string | null) {
  await requireManager();
  const user = await saveAdminProfile(supabaseAdmin, userId, { birth_date: validateBirthDate(value) });
  revalidatePath("/admin/users", "layout");
  return user;
}

export async function saveUserInterestsAction(userId: string, value: string[]) {
  await requireManager();
  const user = await saveAdminProfile(supabaseAdmin, userId, { interests: normalizeInterests(value) });
  revalidatePath("/admin/users", "layout");
  return user;
}

/**
 * The admin "Verified" box: checking it verifies the member's UBC status by
 * hand (`manual`, by this manager), which satisfies the purchase requirement
 * like a code does; unchecking clears the verification whatever its method.
 * The legacy `student_verified_*` columns are written alongside, since the
 * code in production reads them until the cleanup migration.
 */
export async function setStudentVerificationAction(userId: string, verified: boolean) {
  const manager = await requireManager();
  if (typeof verified !== "boolean") throw new Error("Choose a verification status.");
  const now = new Date().toISOString();

  if (verified) {
    // One verified account per address: say so instead of failing the save.
    const { data: target } = await supabaseAdmin
      .from(TABLES.userInfo).select("ubc_email").eq("id", userId).maybeSingle();
    const email = (target as { ubc_email: string | null } | null)?.ubc_email;
    if (email) {
      const { count } = await supabaseAdmin
        .from(TABLES.userInfo)
        .select("id", { count: "exact", head: true })
        .eq("ubc_email", email)
        .neq("id", userId)
        .is("deleted_at", null)
        .not("ubc_verified_at", "is", null);
      if (count) throw new Error("This UBC email is already verified on another account.");
    }
  }

  const user = await saveAdminProfile(supabaseAdmin, userId, {
    student_verified_at: verified ? now : null,
    student_verified_by: verified ? manager.id : null,
    ubc_verified_at: verified ? now : null,
    ubc_verified_via: verified ? "manual" : null,
    ubc_verified_by: verified ? manager.id : null,
  });
  log.info("ubc_verification.manual_set", { userId, managerId: manager.id, verified });
  revalidatePath("/admin/users", "layout");
  revalidatePath("/portal/membership");
  return user;
}

export async function removeUserProfilePhotoAction(userId: string, expectedPath: string | null) {
  await requireManager();
  const user = await replaceProfilePhoto(supabaseAdmin, userId, expectedPath, null);
  revalidatePath("/admin/users", "layout");
  return user;
}
