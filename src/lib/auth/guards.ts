import { redirect } from "next/navigation";

import type { UserInfoRow } from "@/types/models";
import { loadCurrentUser } from "@/lib/auth/current-user";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { hasAdminAccess, hasManagerAccess } from "@/lib/auth/roles";

function authErrorPath(message: string) {
  return `/auth/error?error=${encodeURIComponent(message)}`;
}

/**
 * Uncached wrappers over `loadCurrentUser()`.
 *
 * The redirects stay out here on purpose: `redirect()` throws, and a throw
 * inside the cached loader would memoize a rejected promise for the rest of the
 * request. See the note in `current-user.ts`.
 */
export async function requireAuth(nextPath?: string): Promise<UserInfoRow> {
  const result = await loadCurrentUser();

  if (result.status === "unauthenticated") {
    const safeNextPath = getSafeInternalPath(nextPath);
    redirect(`/auth/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  if (result.status === "error") {
    redirect(authErrorPath(result.message));
  }

  return result.user;
}

export async function redirectIfAuthenticated(redirectTo = "/portal") {
  const result = await loadCurrentUser();
  // An open redirect here would let a crafted auth link bounce a signed-in
  // user off-site, so the destination is sanitized before it is ever used.
  const safeRedirectTo = getSafeInternalPath(redirectTo);

  if (result.status === "unauthenticated") return;

  // Auth pages should send signed-in users to the portal. Sign-up creates the
  // profile row, so a missing one is a repairable leftover the loader has
  // already dealt with, not a reason to ask for the details again.
  if (result.status === "error") {
    redirect(authErrorPath(result.message));
  }

  redirect(safeRedirectTo);
}

export async function requireAdmin(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (!hasAdminAccess(user.role_access)) {
    redirect("/401");
  }

  return user;
}

export async function requireManager(): Promise<UserInfoRow> {
  const user = await requireAuth();

  if (!hasManagerAccess(user.role_access)) {
    redirect("/401");
  }

  return user;
}
