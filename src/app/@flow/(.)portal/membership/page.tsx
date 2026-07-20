import { MembershipPlansRoute } from "@/features/memberships/components/MembershipPlansRoute";

export default async function InterceptedMembershipPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return <MembershipPlansRoute returnTo={(await searchParams).returnTo} />;
}
