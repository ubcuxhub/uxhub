import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { CompleteProfileForm } from "@/features/auth/components/CompleteProfileForm";
import { withDeadline } from "@/lib/async/deadline";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { getPartialUserNameFromMetadata } from "@/lib/user-name";

/**
 * Where a signed-in user lands when their sign-in provider didn't supply both
 * names (see `ensureUserInfo`). It reads the session directly rather than
 * through `requireAuth` or `redirectIfAuthenticated`: both send a user without
 * a profile here, so calling either would loop.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = getSafeInternalPath((await searchParams).next);
  const supabase = await createClient();

  let authUser: User | null = null;
  try {
    const {
      data: { user },
      error,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Session check",
    });
    if (!error) authUser = user;
  } catch {
    authUser = null;
  }

  if (!authUser) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  // A failed read still shows the form: saving is a no-op for a profile that
  // already exists, and then continues to `next`.
  const existing = await withDeadline(
    () => fetchUserInfoByAuthId(supabase, authUser.id),
    { operation: "Existing profile lookup" },
  ).catch(() => null);

  if (existing) {
    redirect(nextPath);
  }

  const prefill = getPartialUserNameFromMetadata(authUser.user_metadata ?? {});

  return (
    <CompleteProfileForm
      nextPath={nextPath}
      email={authUser.email}
      defaultFirstName={prefill.first_name}
      defaultLastName={prefill.last_name}
    />
  );
}
