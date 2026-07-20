import { MembershipPlansRoute } from "@/features/memberships/components/MembershipPlansRoute";

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return <MembershipPlansRoute returnTo={(await searchParams).returnTo} />;
}
