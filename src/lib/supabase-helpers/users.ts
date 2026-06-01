import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { UserInfoRow, UserInfoUpdate } from "@/types/models";

interface UserInfoSeed {
  email?: string;
  name?: string;
}

export interface UserInfoContact {
  id: string;
  name: string;
  email: string;
}

export async function fetchUserInfoByAuthId(
  supabase: DbClient,
  authUserId: string
): Promise<UserInfoRow | null> {
  const { data, error } = await supabase
    .from(TABLES.userInfo)
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchUserInfoContactById(
  supabase: DbClient,
  id: string
): Promise<UserInfoContact | null> {
  const { data, error } = await supabase
    .from(TABLES.userInfo)
    .select("id, name, email")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchUserInfoContactsByIds(
  supabase: DbClient,
  ids: string[]
): Promise<UserInfoContact[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLES.userInfo)
    .select("id, name, email")
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}

export async function updateUserInfoById(
  supabase: DbClient,
  id: string,
  payload: UserInfoUpdate
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.userInfo)
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function updateUserInfoByEmail(
  supabase: DbClient,
  email: string,
  payload: UserInfoUpdate
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.userInfo)
    .update(payload)
    .eq("email", email);

  if (error) throw error;
}

/**
 * Admin user directory rows: user_info joined with the related membership
 * type name. The `membership_types!membership_type_id(name)` hint pins the
 * foreign-key relationship used for the join.
 */
export async function fetchAdminUserRecords(supabase: DbClient) {
  const { data, error } = await supabase
    .from(TABLES.userInfo)
    .select(
      `
      *,
      membership_types!membership_type_id(name)
    `
    )
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Ensures a user_info record exists for the given auth user, creating one if
 * necessary. Returns the user_info auth id used to associate registrations.
 */
export async function ensureUserInfo(
  supabase: DbClient,
  sessionUserId: string,
  user: UserInfoSeed | null
): Promise<string> {
  const { data: existingUserInfo, error: fetchError } = await supabase
    .from(TABLES.userInfo)
    .select("id")
    .eq("auth_user_id", sessionUserId)
    .maybeSingle();

  if (fetchError) {
    const errorCode = "code" in fetchError ? fetchError.code : undefined;
    const errorMessage = fetchError.message || "";

    // PGRST116 is "no rows returned" - expected if user_info doesn't exist yet
    if (errorCode !== "PGRST116" && !errorMessage.includes("No rows")) {
      throw new Error(`Failed to load user information: ${errorMessage}`);
    }
  }

  if (existingUserInfo?.id) {
    return existingUserInfo.id;
  }

  const email = user?.email || "";
  if (!email) {
    throw new Error(
      "Email is required. Please ensure you're logged in with an email address."
    );
  }

  const { data: newUserInfo, error: createError } = await supabase
    .from(TABLES.userInfo)
    .insert({
      email: email,
      name: user?.name || email.split("@")[0] || "User",
      auth_user_id: sessionUserId,
      membership_type: "NonUbc",
      role_access: "basic",
    })
    .select("auth_user_id")
    .single();

  if (createError) {
    // Unique constraint violation - record already exists, reuse session id
    if (createError.code === "23505") {
      return sessionUserId;
    }
    throw new Error(`Failed to set up your profile: ${createError.message}`);
  }

  return newUserInfo?.auth_user_id || sessionUserId;
}
