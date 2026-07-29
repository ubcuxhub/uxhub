import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { UserInfoRow, UserInfoUpdate } from "@/types/models";

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
