import { SignUpSuccessMessage } from "@/features/auth/components/sign-up-success-message";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await redirectIfAuthenticated();

  const params = await searchParams;

  return <SignUpSuccessMessage nextPath={getSafeInternalPath(params.next)} />;
}
