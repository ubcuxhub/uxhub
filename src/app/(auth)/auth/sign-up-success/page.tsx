import { SignUpSuccessMessage } from "@/features/auth/components/sign-up-success-message";
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

  return <SignUpSuccessMessage nextPath={nextPath} />;
}
