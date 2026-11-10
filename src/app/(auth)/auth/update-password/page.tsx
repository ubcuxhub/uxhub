import { redirect } from "next/navigation";

import {
  UpdatePasswordForm,
} from "@/features/auth/components/UpdatePasswordForm";
import { getExpiredLinkPath } from "@/features/auth/link-expired";
import { withDeadline } from "@/lib/async/deadline";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  let email: string | null = null;

  try {
    const {
      data: { user },
      error,
    } = await withDeadline(async () => {
      const supabase = await createClient();
      return supabase.auth.getUser();
    }, { operation: "Recovery session check" });

    if (!error && user?.id) email = user.email ?? "";
  } catch {
    email = null;
  }

  // No recovery session: the link expired, was already used, or was opened in
  // a browser that did not ask for it.
  if (email === null) {
    redirect(getExpiredLinkPath("reset"));
  }

  return <UpdatePasswordForm email={email} />;
}
