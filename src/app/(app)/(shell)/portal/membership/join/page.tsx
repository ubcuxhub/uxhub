import { MembershipClassificationRoute } from "@/features/memberships/components/MembershipClassificationRoute";

export default async function MembershipJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; change?: string }>;
}) {
  const { returnTo, change } = await searchParams;
  return (
    <MembershipClassificationRoute returnTo={returnTo} change={change != null} />
  );
}
