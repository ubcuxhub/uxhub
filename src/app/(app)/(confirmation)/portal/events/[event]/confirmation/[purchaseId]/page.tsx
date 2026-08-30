import { EventConfirmationRoute } from "@/features/events/components/EventConfirmationRoute";

export default async function EventConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ event: string; purchaseId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ event, purchaseId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <EventConfirmationRoute
      purchaseId={purchaseId}
      returnTo={query.returnTo}
      slug={event}
    />
  );
}
