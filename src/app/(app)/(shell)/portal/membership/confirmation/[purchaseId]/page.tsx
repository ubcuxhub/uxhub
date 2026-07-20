import { MembershipConfirmationRoute } from "@/features/memberships/components/MembershipConfirmationRoute";

export default async function MembershipConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ purchaseId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ purchaseId }, query] = await Promise.all([params, searchParams]);
  return (
    <MembershipConfirmationRoute
      purchaseId={purchaseId}
      returnTo={query.returnTo}
    />
  );
}
