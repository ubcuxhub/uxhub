import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { TABLES } from "./tables";

/**
 * Service-role data-access helpers. These bypass Row Level Security and must
 * only be called from server-only code (route handlers, server actions).
 *
 * Payloads are intentionally permissive because the privileged client is
 * untyped (see `@/lib/supabase/admin`). Keep the raw column shapes at the call
 * sites so they remain easy to audit.
 */

type UserInfoWritePayload = Record<string, unknown>;

export interface AdminUserInfoLookup {
  id: string;
  auth_user_id: string | null;
  email: string;
}

export async function adminFindUserInfoIdByEmail(
  email: string
): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin
    .from(TABLES.userInfo)
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return (data as { id: string } | null) ?? null;
}

export async function adminFindUserInfoByEmail(
  email: string
): Promise<AdminUserInfoLookup | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .select("id, auth_user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return (data as AdminUserInfoLookup | null) ?? null;
}

export async function adminUpdateUserInfoById(
  id: string,
  payload: UserInfoWritePayload
) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .update(payload)
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}

export async function adminUpdateUserInfoByEmail(
  email: string,
  payload: UserInfoWritePayload
) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .update(payload)
    .eq("email", email)
    .select();

  if (error) throw error;
  return data;
}

export async function adminInsertUserInfo(payload: UserInfoWritePayload) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .insert(payload)
    .select();

  if (error) throw error;
  return data;
}

export async function adminUpdateMembershipByEmail(
  email: string,
  payload: UserInfoWritePayload
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .update(payload)
    .eq("email", email);

  return { error };
}
