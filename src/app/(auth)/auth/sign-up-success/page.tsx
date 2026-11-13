import { redirect } from "next/navigation";

import { getSafeInternalPath } from "@/lib/auth/paths";

/** The old name of the Verify email screen; kept so existing links still work. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = getSafeInternalPath((await searchParams).next);
  redirect(`/auth/verify-email?next=${encodeURIComponent(nextPath)}`);
}
