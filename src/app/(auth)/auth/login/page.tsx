import { LoginForm } from "@/features/auth";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

import { getSafeInternalPath } from "@/lib/auth/paths";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = getSafeInternalPath((await searchParams).next);
  await redirectIfAuthenticated(nextPath);

  return (
    <LoginForm nextPath={nextPath} />
  );
}
