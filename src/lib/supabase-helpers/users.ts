import type { DbClient } from "./types";
import { fetchAllPages } from "./all-pages";
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
 * The admin user directory: every account's listed columns (what the list
 * shows, searches, sorts and filters on, and nothing more, since every row
 * goes to the browser) with its membership tier name. The
 * `membership_types!membership_type_id(name)` hint pins the foreign key used
 * for the join. Paged, so the directory is complete past PostgREST's
 * 1000-row cap; a user's record reads the rest of their row.
 *
 * Rows left behind by self-serve account deletion are excluded — they are
 * anonymized placeholders kept only so purchases and event registrations keep
 * a referent, and they are not people an admin can act on.
 */
export async function fetchAdminUserRecords(supabase: DbClient) {
  return fetchAllPages((from, to) =>
    supabase
      .from(TABLES.userInfo)
      .select(
        "id, first_name, last_name, email, major, role_access, membership_type_id, created_at, membership_types!membership_type_id(name)"
      )
      .is("deleted_at", null)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .order("id")
      .range(from, to)
  );
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

  let verifier: StudentVerifier | null = null;
  if (row.student_verified_by) {
    const { data, error: verifierError } = await supabase
      .from(TABLES.userInfo)
      .select("id, first_name, last_name")
      .eq("id", row.student_verified_by)
      .is("deleted_at", null)
      .maybeSingle();
    if (verifierError) throw verifierError;
    verifier = data;
  }

  return { row, verifier };
}
