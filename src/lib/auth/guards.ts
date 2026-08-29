import { redirect } from "next/navigation";

import type { UserInfoRow } from "@/types/models";
import { createClient } from "@/lib/supabase/server";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { getSafeInternalPath } from "@/lib/auth/paths";

function authErrorPath(message: string) {
  return `/auth/error?error=${encodeURIComponent(message)}`;
}

export async function requireAuth(nextPath?: string): Promise<UserInfoRow> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    const safeNextPath = getSafeInternalPath(nextPath);
    redirect(`/auth/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (userInfo) {
    return userInfo;
  }

  // An authenticated user without a profile row predates the sign-up flow that
  // creates one, or lost it to a failed insert. Repair it here rather than
  // stranding the session, then re-read so the returned row is the typed one.
  const ensured = await ensureUserInfo(authUser);

  if (ensured.status === "conflict") {
    redirect(authErrorPath(ensured.message));
  }

  const repaired = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (!repaired) {
    redirect(authErrorPath("Unable to load your profile."));
  }

  return repaired;
}

export async function redirectIfAuthenticated(redirectTo = "/portal") {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return;

  // Auth pages should send signed-in users to the portal. Sign-up creates the
  // profile row, so a missing one is a repairable leftover, not a reason to ask
  // for the details again.
  const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (userInfo) {
    redirect(redirectTo);
  }

  const ensured = await ensureUserInfo(authUser);

  if (ensured.status === "conflict") {
    redirect(authErrorPath(ensured.message));
  }

  redirect(redirectTo);
}

export async function requireAdmin(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (user.role_access !== "admin") {
    redirect("/401");
  }

  return user;
}
