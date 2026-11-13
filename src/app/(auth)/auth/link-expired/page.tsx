import { LinkExpiredMessage } from "@/features/auth/components/LinkExpiredMessage";
import { parseExpiredLinkType } from "@/features/auth/link-expired";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { redirectIfAuthenticated } from "@/lib/auth/guards";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; next?: string }>;
}) {
  const params = await searchParams;
  const type = parseExpiredLinkType(params.type);
  const nextPath = getSafeInternalPath(params.next);
  await redirectIfAuthenticated(nextPath);

  return <LinkExpiredMessage type={type} nextPath={nextPath} />;
}
