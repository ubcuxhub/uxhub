import { MembershipCheckoutRoute } from "@/features/memberships/components/MembershipCheckoutRoute";

export default async function InterceptedMembershipCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ membership: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { membership } = await params;
  return (
    <MembershipCheckoutRoute
      slug={membership}
      returnTo={(await searchParams).returnTo}
    />
  );
}
