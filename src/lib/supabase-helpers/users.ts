import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { UserInfoRow, UserInfoUpdate } from "@/lib/supabase/models";

export interface UserInfoContact {
  id: string;
  first_name: string;
  last_name: string;
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
    .select("id, first_name, last_name, email")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Just the membership fields, for callers that need a member's expiry without
 * pulling the whole user row. Pair with `getEffectiveMembershipExpiry` so the
 * club-wide term end is applied.
 */
export async function fetchUserMembershipExpiryById(
  supabase: DbClient,
  id: string
): Promise<Pick<
  UserInfoRow,
  "membership_expires_at" | "membership_type_id"
> | null> {
  const { data, error } = await supabase
    .from(TABLES.userInfo)
    .select("membership_expires_at, membership_type_id")
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
    .select("id, first_name, last_name, email")
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
 *
 * Rows left behind by self-serve account deletion are excluded — they are
 * anonymized placeholders kept only so purchases and event registrations keep
 * a referent, and they are not people an admin can act on.
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
    .is("deleted_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who marked a student verified, when that profile still exists. */
export interface StudentVerifier {
  id: string;
  first_name: string;
  last_name: string;
}

/**
 * One admin user record by `user_info.id`: the row with its membership tier
 * name (as `fetchAdminUserRecords` joins it) and the manager who verified the
 * student, or null when that manager's profile is gone.
 *
 * Returns null for an id that isn't a UUID, an unknown id, or a row left
 * behind by account deletion, which the directory doesn't list either.
 */
export async function fetchAdminUserRecordById(supabase: DbClient, id: string) {
  if (!UUID.test(id)) return null;

  const { data: row, error } = await supabase
    .from(TABLES.userInfo)
    .select(
      `
      *,
      membership_types!membership_type_id(name)
    `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  // The manager behind a manual UBC verification.
  const verifierId = row.ubc_verified_by;
  let verifier: StudentVerifier | null = null;
  if (verifierId) {
    const { data, error: verifierError } = await supabase
      .from(TABLES.userInfo)
      .select("id, first_name, last_name")
      .eq("id", verifierId)
      .is("deleted_at", null)
      .maybeSingle();
    if (verifierError) throw verifierError;
    verifier = data;
  }

  return { row, verifier };
}
