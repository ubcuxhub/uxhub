import { cache } from "react";

import type { UserInfoRow } from "@/types/models";
import { createClient } from "@/lib/supabase/server";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

export type CurrentUserResult =
  | { status: "authenticated"; user: UserInfoRow }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

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

  const existing = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (existing) {
    return { status: "authenticated", user: existing };
  }

  // An authenticated user without a profile row predates the sign-up flow that
  // creates one, or lost it to a failed insert. Repair it here rather than
  // stranding the session, then re-read so the returned row is the typed one.
  // Being inside the cache also means the repair — which writes — runs at most
  // once per request instead of once per guard call.
  const ensured = await ensureUserInfo(authUser);

  if (ensured.status === "conflict") {
    return { status: "error", message: ensured.message };
  }

  const repaired = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (!repaired) {
    return { status: "error", message: "Unable to load your profile." };
  }

  return { status: "authenticated", user: repaired };
});
