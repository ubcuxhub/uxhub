import { redirect } from "next/navigation";

import type { UserInfoRow } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

export async function requireAuth(): Promise<UserInfoRow> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/auth/login");
  }

  const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (!userInfo) {
    redirect("/auth/login");
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
