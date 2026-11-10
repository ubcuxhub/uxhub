import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { UserInfoRow, UserInfoUpdate } from "@/lib/supabase/models";

/**
 * Member setup columns of `user_info` (migrations 20261110030244 and
 * 20261110041028).
 *
 * With a member's own client, RLS limits these to their row and the column
 * grants to `setup_step`, `diets`, `allergies`, `other_allergies`,
 * `avatar_preset` and `user_type_confirmed_at`. `interests`,
 * `profile_photo_path` and `user_type` need the service-role client, which
 * the setup actions use only for the signed-in member's id.
 */
export const USER_SETUP_COLUMNS =
  "setup_step, user_type, user_type_confirmed_at, diets, allergies, other_allergies, avatar_preset, profile_photo_path, interests";

export type UserSetupRow = Pick<
  UserInfoRow,
  | "setup_step"
  | "user_type"
  | "user_type_confirmed_at"
  | "diets"
  | "allergies"
  | "other_allergies"
  | "avatar_preset"
  | "profile_photo_path"
  | "interests"
>;

export type UserSetupUpdate = Pick<
  UserInfoUpdate,
  | "setup_step"
  | "user_type_confirmed_at"
  | "diets"
  | "allergies"
  | "other_allergies"
  | "avatar_preset"
  | "interests"
>;

/** The setup columns of an active (not deleted) profile. Throws when there is none. */
export async function fetchUserSetup(db: DbClient, userId: string): Promise<UserSetupRow> {
  const { data, error } = await db
    .from(TABLES.userInfo)
    .select(USER_SETUP_COLUMNS)
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Active user not found.");
  return data;
}

/**
 * Writes setup columns on an active profile and returns them. Throws when the
 * write is refused or matches no row (deleted, or not the caller's under RLS).
 */
export async function updateUserSetup(
  db: DbClient,
  userId: string,
  patch: UserSetupUpdate
): Promise<UserSetupRow> {
  const { data, error } = await db
    .from(TABLES.userInfo)
    .update(patch)
    .eq("id", userId)
    .is("deleted_at", null)
    .select(USER_SETUP_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Unable to save setup.");
  return data;
}

/** The membership columns a `user_type` change is checked against. */
export type UserTypeChangeGuard = Pick<
  UserInfoRow,
  "id" | "membership_type_id" | "membership_pre_ordered_type_id" | "membership_expires_at"
>;

/**
 * Writes a new `user_type` (with the eligibility columns it clears and any
 * setup columns) only while the membership columns still hold what the caller
 * checked, so a membership bought in between can't end up with a type it
 * wasn't sold to. Returns null when they changed. Service-role client only:
 * members can't write `user_type`.
 */
export async function updateUserTypeIfMembershipUnchanged(
  db: DbClient,
  checked: UserTypeChangeGuard,
  patch: UserInfoUpdate
): Promise<UserSetupRow | null> {
  let query = db
    .from(TABLES.userInfo)
    .update(patch)
    .eq("id", checked.id)
    .is("deleted_at", null);
  for (const column of [
    "membership_type_id",
    "membership_pre_ordered_type_id",
    "membership_expires_at",
  ] as const) {
    const value = checked[column];
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }
  const { data, error } = await query.select(USER_SETUP_COLUMNS).maybeSingle();

  if (error) throw error;
  return data;
}

/** An active profile's `setup_step` by auth user id, or null when there is none. */
export async function fetchSetupStepByAuthId(
  db: DbClient,
  authUserId: string
): Promise<string | null> {
  const { data, error } = await db
    .from(TABLES.userInfo)
    .select("setup_step")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data?.setup_step ?? null;
}
