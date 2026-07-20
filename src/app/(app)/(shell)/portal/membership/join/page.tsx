import { MembershipClassificationRoute } from "@/features/memberships/components/MembershipClassificationRoute";

export default async function MembershipJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return (
    <MembershipClassificationRoute returnTo={(await searchParams).returnTo} />
  );
}
