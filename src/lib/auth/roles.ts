import type { RoleAccess } from "@/lib/supabase/models";

export function hasAdminAccess(
  role: RoleAccess | null | undefined
): boolean {
  return role === "admin" || role === "manager";
}

export function hasManagerAccess(
  role: RoleAccess | null | undefined
): boolean {
  return role === "manager";
}
