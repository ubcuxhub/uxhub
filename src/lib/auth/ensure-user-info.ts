import type { User } from "@supabase/supabase-js";

import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import {
  adminFindUserInfoByEmail,
  adminInsertUserInfo,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { getPartialUserNameFromMetadata } from "@/lib/user-name";

export type EnsureUserInfoResult =
  | { status: "ok" }
  /**
   * Neither the caller nor the auth metadata supplied both names, e.g. a
   * Google account with a one-word name. Recoverable: the caller sends the
   * user to `/auth/complete-profile` to type them.
   */
  | { status: "missing_name" }
  | { status: "conflict"; reason: ProfileConflictReason; message: string };

export type ProfileConflictReason = "missing_email" | "linked_elsewhere";

/**
 * Stable log events for a conflict, so callers can log the cause without the
 * member-facing message. Each caller logs it once, with its own context.
 */
export const PROFILE_CONFLICT_EVENTS: Record<ProfileConflictReason, string> = {
  missing_email: "auth.profile_missing_email",
  linked_elsewhere: "auth.profile_linked_elsewhere",
};

const LINKED_ELSEWHERE: EnsureUserInfoResult = {
  status: "conflict",
  reason: "linked_elsewhere",
  message:
    "An account with this email is already linked to another sign-in method.",
};

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
 * different destination for the conflict and missing-name cases.
 */
export async function ensureUserInfo(
  authUser: User,
  overrides?: { firstName?: string; lastName?: string }
): Promise<EnsureUserInfoResult> {
  const supabase = await createClient();

  const existingByAuthId = await fetchUserInfoByAuthId(
    supabase,
    authUser.id,
  );

  if (existingByAuthId) {
    return { status: "ok" };
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      status: "conflict",
      reason: "missing_email",
      message: "Your account is missing an email address.",
    };
  }

  const metadataName = getPartialUserNameFromMetadata(
    authUser.user_metadata ?? {},
  );
  const firstName = overrides?.firstName?.trim() || metadataName.first_name;
  const lastName = overrides?.lastName?.trim() || metadataName.last_name;

  if (!firstName || !lastName) {
    // Expected for some OAuth accounts, so `warn`: the user can fix it.
    log.warn("auth.profile_name_missing", { authUserId: authUser.id });
    return { status: "missing_name" };
  }

  const payload = {
    auth_user_id: authUser.id,
    email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
  };

  const existingByEmail = await adminFindUserInfoByEmail(normalizedEmail);

  if (existingByEmail) {
    if (
      existingByEmail.auth_user_id &&
      existingByEmail.auth_user_id !== authUser.id
    ) {
      return LINKED_ELSEWHERE;
    }

    await adminUpdateUserInfoById(existingByEmail.id, payload);
    return { status: "ok" };
  }

  try {
    await adminInsertUserInfo({
      ...payload,
      newsletter: false,
      role_access: "basic",
    });
  } catch (insertError) {
    // Another request may have created or adopted this row after both lookups
    // above. Reconcile against the desired final state before deciding that
    // the insert failed; this makes retries after a lost response safe.
    const racedByAuthId = await fetchUserInfoByAuthId(supabase, authUser.id);

    if (racedByAuthId) {
      return { status: "ok" };
    }

    const racedByEmail = await adminFindUserInfoByEmail(normalizedEmail);

    if (!racedByEmail) {
      throw insertError;
    }

    if (
      racedByEmail.auth_user_id &&
      racedByEmail.auth_user_id !== authUser.id
    ) {
      return LINKED_ELSEWHERE;
    }

    if (!racedByEmail.auth_user_id) {
      await adminUpdateUserInfoById(racedByEmail.id, payload);
    }
  }

  return { status: "ok" };
}
