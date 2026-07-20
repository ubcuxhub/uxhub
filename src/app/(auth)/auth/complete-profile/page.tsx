import { redirect } from "next/navigation";

import { CompleteProfileForm } from "@/features/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";
import { getSafeInternalPath } from "@/lib/auth/paths";

function getInitialNameFromMetadata(metadata: Record<string, unknown>) {
  const candidateKeys = ["full_name", "name", "given_name"];

  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = getSafeInternalPath((await searchParams).next);
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id || !authUser.email) {
    redirect("/auth/login");
  }

  const existingProfile = await fetchUserInfoByAuthId(supabase, authUser.id)
    .catch(() => null);

  if (existingProfile) {
    redirect(nextPath);
  }

  const initialName = getInitialNameFromMetadata(authUser.user_metadata ?? {});

  return (
    <CompleteProfileForm
      initialEmail={authUser.email.trim().toLowerCase()}
      initialName={initialName}
      nextPath={nextPath}
    />
  );
}
