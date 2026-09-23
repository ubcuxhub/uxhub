"use server";

import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

export type CompleteProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Creates the signed-in user's profile right after sign-up.
 *
 * Only called when email confirmation is disabled, so `signUp` returned a
 * session; otherwise the confirmation callback creates the profile once the
 * session exists. The user is identified by that session, never by the input,
 * and a repeat call after the profile exists succeeds without writing.
 */
export async function completeProfileAction(input: {
  firstName: string;
  lastName: string;
}): Promise<CompleteProfileResult> {
  try {
    const supabase = await withDeadline(() => createClient(), {
      operation: "Profile completion",
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Authenticated user lookup",
    });

    if (authError || !authUser?.id || !authUser.email) {
      return {
        ok: false,
        error: "You must be signed in to complete your profile.",
      };
    }

    const existingByAuthId = await withDeadline(
      () => fetchUserInfoByAuthId(supabase, authUser.id),
      { operation: "Existing profile lookup" },
    );

    if (existingByAuthId) return { ok: true };

    // Server actions are public endpoints, so the input's shape is not
    // guaranteed by its type.
    const firstName = String(input?.firstName ?? "").trim();
    const lastName = String(input?.lastName ?? "").trim();

    if (!firstName || !lastName) {
      return { ok: false, error: "First and last name are required." };
    }

    const result = await withDeadline(
      () => ensureUserInfo(authUser, { firstName, lastName }),
      { operation: "Profile creation" },
    );

    if (result.status === "conflict") {
      return { ok: false, error: result.message };
    }

    return { ok: true };
  } catch (error) {
    if (isAsyncTimeoutError(error)) {
      return { ok: false, error: getAsyncErrorMessage(error) };
    }

    log.error("auth.profile_completion_failed", errorFields(error));

    return {
      ok: false,
      error: "Unable to complete your profile. Please try again.",
    };
  }
}
