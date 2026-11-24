"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RoleAccess, UserInfoRow, UserInfoUpdate } from "@/lib/supabase/models";
import { ActiveProfileNotFoundError, fetchActiveProfile, saveAdminProfile } from "@/lib/supabase-helpers/admin-user-profile";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { normalizeInterests, validateBirthDate } from "./lib/user-profile";
import { managerUserUpdate, refusing, UserEditRefusal } from "./lib/manager-user-update";

/** A user edit's outcome: the saved row, or why it was refused, for the manager. */
export type ManagerUserSaveResult =
  | { ok: true; user: UserInfoRow }
  | { ok: false; error: string };

/** The update a manager's edit makes, validated as a whole before anything is written. */
async function managerUserPatch(userId: string, changes: Record<string, unknown>): Promise<UserInfoUpdate> {
  const patch: UserInfoUpdate = {};
  for (const [field, value] of Object.entries(changes)) {
    if (field === "birth_date") patch.birth_date = refusing(() => validateBirthDate(value));
    else if (field === "interests") patch.interests = refusing(() => normalizeInterests(value));
    else if (field === "school_institution") {
      if (value !== null && typeof value !== "string") throw new UserEditRefusal("Enter a valid school or institution.");
      const user = await fetchActiveProfile(supabaseAdmin, userId);
      const school = typeof value === "string" ? value.trim() || null : null;
      if (school === user.school_institution) continue;
      // Validate against the resulting membership, including a tier changed in this save.
      const membershipId = Object.hasOwn(changes, "membership_type_id") ? changes.membership_type_id : user.membership_type_id;
      const membership = typeof membershipId === "string" && membershipId
        ? await fetchMembershipTypeById(supabaseAdmin, membershipId) : null;
      if (membership?.name !== "nonUbc") throw new UserEditRefusal("School can only be changed for Non-UBC members.");
      patch.school_institution = school;
    }
    else if (field === "email") {
      // A linked account's address is its sign-in email, so editing only
      // user_info would split the two: deletion, faculty eligibility and
      // receipts would follow the new one while sign-in kept the old. Only a
      // profile with no sign-in yet (an import a sign-up will adopt by email)
      // can be corrected here, normalized the way ensureUserInfo matches it.
      const email = typeof value === "string" ? value.trim().toLowerCase() : "";
      const user = await fetchActiveProfile(supabaseAdmin, userId);
      if (email === user.email) continue;
      if (user.auth_user_id) throw new UserEditRefusal("This member signs in with this email, so it can't be changed here.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserEditRefusal("Enter a valid email address.");
      patch.email = email;
    }
    else Object.assign(patch, managerUserUpdate(field, value));
  }
  return patch;
}

/**
 * Saves the form's profile fields together; roles keep their separate RPC
 * guard. An invalid field, an email another account uses, or a deleted user
 * comes back as a refusal, and nothing is written.
 */
export async function saveManagerUserDetailsAction(userId: string, changes: Record<string, unknown>): Promise<ManagerUserSaveResult> {
  await requireManager();
  if (!userId) throw new Error("A user id is required.");
  try {
    const user = await saveAdminProfile(supabaseAdmin, userId, await managerUserPatch(userId, changes));
    revalidatePath("/admin/users", "layout");
    return { ok: true, user };
  } catch (error) {
    const refusal =
      error instanceof UserEditRefusal || error instanceof ActiveProfileNotFoundError ? error.message
      : isPostgrestError(error) && error.code === "23505" && /email/.test(error.message) ? "Another account already uses this email."
      : null;
    if (!refusal) throw error;
    log.warn("admin.user_edit_refused", { userId, fields: Object.keys(changes).join(",") });
    return { ok: false, error: refusal };
  }
}

function isPostgrestError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string" && typeof (error as { message?: unknown }).message === "string";
}

/** A role change's outcome: the role now held, or why `set_user_role` refused it. */
export type UserRoleResult = { ok: true; role: RoleAccess } | { ok: false; error: string };

/** What `set_user_role` raises for an expected refusal, in words a manager can act on. */
function roleRefusal(error: { code?: string; message: string }): string | null {
  if (error.message.includes("The final manager cannot be demoted")) {
    return "This is the only manager. Make someone else a manager before changing this role.";
  }
  if (error.code === "42501") return "Only managers can change role access.";
  if (error.code === "P0002") return "This user no longer exists. Reload the user directory.";
  return null;
}

export async function updateUserRoleAction(
  userId: string,
  role: RoleAccess
): Promise<UserRoleResult> {
  await requireManager();

  if (!userId) {
    throw new Error("A user id is required.");
  }
  if (role !== "basic" && role !== "admin" && role !== "manager") {
    throw new Error("Invalid role.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_user_role", {
    p_target_user_id: userId,
    p_role: role,
  });

  if (error) {
    const refusal = roleRefusal(error);
    if (!refusal) throw error;
    log.warn("admin.user_role_refused", { userId, role });
    return { ok: false, error: refusal };
  }
  if (!data) throw new Error("The role update returned no role.");

  revalidatePath("/admin/users", "layout");
  return { ok: true, role: data };
}
