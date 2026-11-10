import { VerifyEmailMessage } from "@/features/auth/components/VerifyEmailMessage";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeInternalPath(params.next);
  await redirectIfAuthenticated(nextPath);

  return <VerifyEmailMessage nextPath={nextPath} />;
}
