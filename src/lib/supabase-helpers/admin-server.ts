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
