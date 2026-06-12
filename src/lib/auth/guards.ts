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

export async function redirectIfAuthenticated(redirectTo = "/portal/events") {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return;

  // Only redirect away from auth pages when the user is *fully* authenticated,
  // i.e. they also have a user_info profile row. This mirrors requireAuth() so
  // an "orphaned" session (auth user with no profile, e.g. a failed sign-up)
  // can't bounce between the portal guard and the auth pages forever
  // (ERR_TOO_MANY_REDIRECTS). Without a profile, the user stays on the auth
  // page and can sign in with a complete account.
  const userInfo = await fetchUserInfoByAuthId(supabase, authUser.id).catch(
    () => null
  );

  if (userInfo) {
    redirect(redirectTo);
  }
}

export async function requireAdmin(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (user.role_access !== "admin") {
    redirect("/401");
  }

  return user;
}
