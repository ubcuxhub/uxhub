"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { replaceProfilePhoto, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";
import { normalizeInterests, validateBirthDate } from "./lib/user-profile";

export async function saveUserBirthDateAction(userId: string, value: string | null) {
  await requireManager();
  const user = await saveAdminProfile(supabaseAdmin, userId, { birth_date: validateBirthDate(value) });
  revalidatePath("/admin/users");
  return user;
}

export async function saveUserInterestsAction(userId: string, value: string[]) {
  await requireManager();
  const user = await saveAdminProfile(supabaseAdmin, userId, { interests: normalizeInterests(value) });
  revalidatePath("/admin/users");
  return user;
}

export async function setStudentVerificationAction(userId: string, verified: boolean) {
  const manager = await requireManager();
  if (typeof verified !== "boolean") throw new Error("Choose a verification status.");
  const user = await saveAdminProfile(supabaseAdmin, userId, {
    student_verified_at: verified ? new Date().toISOString() : null,
    student_verified_by: verified ? manager.id : null,
  });
  revalidatePath("/admin/users");
  return user;
}

export async function removeUserProfilePhotoAction(userId: string, expectedPath: string | null) {
  await requireManager();
  const user = await replaceProfilePhoto(supabaseAdmin, userId, expectedPath, null);
  revalidatePath("/admin/users");
  return user;
}
