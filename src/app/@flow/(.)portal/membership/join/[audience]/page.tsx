import { MembershipDetailsRoute } from "@/features/memberships/components/MembershipDetailsRoute";

export default async function InterceptedMembershipDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ audience: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ audience }, query] = await Promise.all([params, searchParams]);
  return (
    <MembershipDetailsRoute audience={audience} returnTo={query.returnTo} />
  );
}
