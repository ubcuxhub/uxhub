import { redirect } from "next/navigation";

import type { UserInfoRow } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";

export async function requireAuth(): Promise<UserInfoRow> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/auth/login");
  }

  const { data: userInfo, error: userInfoError } = await supabase
    .from("user_info")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();

  if (userInfoError || !userInfo) {
    redirect("/auth/login");
  }

  return userInfo;
}

export async function requireAdmin(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (user.role_access !== "admin") {
    redirect("/401");
  }

  return user;
}
