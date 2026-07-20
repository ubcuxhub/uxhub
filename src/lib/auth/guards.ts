import { redirect } from "next/navigation";

import type { UserInfoRow } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { getSafeInternalPath } from "@/lib/auth/paths";

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

  if (!userInfo) {
    const safeNextPath = getSafeInternalPath(nextPath);
    redirect(`/auth/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  return userInfo;
}

export async function redirectIfAuthenticated(redirectTo = "/portal") {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return;

  // Auth pages should send signed-in users either to the portal (profile row
  // exists) or to the profile-completion step (auth user exists, profile row
  // does not). 
  const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (userInfo) {
    redirect(redirectTo);
  }

  redirect("/auth/complete-profile");
}

export async function requireAdmin(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (user.role_access !== "admin") {
    redirect("/401");
  }

  return user;
}
