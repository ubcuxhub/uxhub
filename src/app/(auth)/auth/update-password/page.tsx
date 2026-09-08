import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/features/auth";
import { withDeadline } from "@/lib/async/deadline";
import { createClient } from "@/lib/supabase/server";

const INVALID_RECOVERY_MESSAGE =
  "This password reset link is invalid or has expired. Request a new link and try again.";

export default async function Page() {
  let hasValidSession = false;

  try {
    const {
      data: { user },
      error,
    } = await withDeadline(async () => {
      const supabase = await createClient();
      return supabase.auth.getUser();
    }, { operation: "Recovery session check" });

    hasValidSession = !error && Boolean(user?.id);
  } catch {
    hasValidSession = false;
  }

  if (!hasValidSession) {
    redirect(
      `/auth/error?error=${encodeURIComponent(INVALID_RECOVERY_MESSAGE)}&next=${encodeURIComponent("/auth/update-password")}`,
    );
  }

  return <UpdatePasswordForm />;
}
