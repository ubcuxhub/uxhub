import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  adminFindUserInfoByEmail,
  adminInsertUserInfo,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

export type EnsureUserInfoResult =
  | { status: "ok" }
  | { status: "conflict"; message: string };

const LINKED_ELSEWHERE_MESSAGE =
  "An account with this email is already linked to another sign-in method.";

function getNameFromMetadata(metadata: Record<string, unknown>) {
  const candidateKeys = ["full_name", "name", "given_name"];

  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

/**
 * Guarantees the signed-in auth user has a `user_info` profile row.
 *
 * A profile row can predate the auth user: imported memberships and seeded
 * members exist with a null `auth_user_id`. Those rows are adopted by id rather
 * than replaced, so anything already attached to them (memberships, purchases)
 * survives sign-up. `user_info.email` is unique, so an email that already
 * belongs to a different auth user is a conflict the caller must surface.
 *
 * Callers get a result instead of an exception because each entry point has a
 * different destination for the conflict case.
 */
export async function ensureUserInfo(
  authUser: User,
  overrides?: { name?: string }
): Promise<EnsureUserInfoResult> {
  const supabase = await createClient();

  const existingByAuthId = await fetchUserInfoByAuthId(
    supabase,
    authUser.id
  ).catch(() => null);

  if (existingByAuthId) {
    return { status: "ok" };
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      status: "conflict",
      message: "Your account is missing an email address.",
    };
  }

  const name =
    overrides?.name?.trim() ||
    getNameFromMetadata(authUser.user_metadata ?? {}) ||
    normalizedEmail.split("@")[0];

  const payload = {
    auth_user_id: authUser.id,
    email: normalizedEmail,
    name,
  };

  const existingByEmail = await adminFindUserInfoByEmail(normalizedEmail);

  if (existingByEmail) {
    if (
      existingByEmail.auth_user_id &&
      existingByEmail.auth_user_id !== authUser.id
    ) {
      return { status: "conflict", message: LINKED_ELSEWHERE_MESSAGE };
    }

    await adminUpdateUserInfoById(existingByEmail.id, payload);
    return { status: "ok" };
  }

  await adminInsertUserInfo({
    ...payload,
    newsletter: false,
    role_access: "basic",
  });

  return { status: "ok" };
}
