import { cache } from "react";

import type { AuthErrorCode } from "@/lib/auth/auth-error";
import type { UserInfoRow } from "@/lib/supabase/models";
import { createClient } from "@/lib/supabase/server";
import {
  PROFILE_CONFLICT_EVENTS,
  ensureUserInfo,
} from "@/lib/auth/ensure-user-info";
import { errorFields, log } from "@/lib/log";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

export type CurrentUserResult =
  | { status: "authenticated"; user: UserInfoRow }
  | { status: "unauthenticated" }
  /**
   * Signed in, but no profile row and no name to build one from (an OAuth
   * account with a one-word name). The guards send them to
   * `/auth/complete-profile`.
   */
  | { status: "needs_profile" }
  /** The guards send it to `/auth/error` with this code. */
  | { status: "error"; code: AuthErrorCode };

/**
 * Resolves the signed-in user once per request.
 *
 * `(app)/layout.tsx` and every page's `requireAdmin()` both need the current
 * user, so without memoization one `/admin/*` render repeats `getUser()` and
 * the `user_info` read two or three times. React `cache()` collapses them to
 * one.
 *
 * Two properties of this function are load-bearing, and neither is optional:
 *
 * - **It takes no arguments.** `cache()` keys on arguments, and `requireAuth`
 *   is called with three different `nextPath` values across the app. Caching
 *   at that layer would create one entry per call site and dedupe nothing.
 * - **It never redirects.** `redirect()` throws, so redirecting from inside a
 *   cached function memoizes a rejected promise for the rest of the request.
 *   The redirects live in the uncached wrappers in `guards.ts`, which keeps
 *   the invariant here simple: this only ever resolves.
 */
export const loadCurrentUser = cache(async (): Promise<CurrentUserResult> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { status: "unauthenticated" };
  }

  // A failed read is not "no profile": treating it as one would run the
  // repair below, which writes, on a database hiccup.
  let existing: UserInfoRow | null;
  try {
    existing = await fetchUserInfoByAuthId(supabase, authUser.id);
  } catch (error) {
    log.error("auth.profile_read_failed", {
      ...errorFields(error),
      authUserId: authUser.id,
    });
    return { status: "error", code: "profile_unavailable" };
  }

  if (existing) {
    return { status: "authenticated", user: existing };
  }

  // An authenticated user without a profile row predates the sign-up flow that
  // creates one, or lost it to a failed insert. Repair it here rather than
  // stranding the session, then re-read so the returned row is the typed one.
  // Being inside the cache also means the repair — which writes — runs at most
  // once per request instead of once per guard call.
  const ensured = await ensureUserInfo(authUser);

  if (ensured.status === "missing_name") {
    return { status: "needs_profile" };
  }

  // Logged here, once per request, so the guards that turn these into an
  // /auth/error redirect don't log the same cause again.
  if (ensured.status === "conflict") {
    log.warn(PROFILE_CONFLICT_EVENTS[ensured.reason], {
      authUserId: authUser.id,
      source: "current_user",
    });
    return { status: "error", code: ensured.reason };
  }

  let repaired: UserInfoRow | null;
  try {
    repaired = await fetchUserInfoByAuthId(supabase, authUser.id);
  } catch (error) {
    log.error("auth.profile_read_failed", {
      ...errorFields(error),
      authUserId: authUser.id,
    });
    return { status: "error", code: "profile_unavailable" };
  }

  if (!repaired) {
    log.warn("auth.profile_repair_missing", { authUserId: authUser.id });
    return { status: "error", code: "profile_unavailable" };
  }

  return { status: "authenticated", user: repaired };
});
