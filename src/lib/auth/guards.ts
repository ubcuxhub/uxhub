import { redirect } from "next/navigation";

import type { User } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";

export async function requireAuth(): Promise<User> {
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

  return userInfo as User;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();

  if (user.role_access !== "admin") {
    redirect("/401");
  }

  return user;
}
