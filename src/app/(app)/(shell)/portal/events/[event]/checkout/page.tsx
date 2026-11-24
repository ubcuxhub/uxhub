import { EventCheckoutRoute } from "@/features/events/components/EventCheckoutRoute";

export default async function EventCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ event: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { event } = await params;

  return (
    <EventCheckoutRoute
      slug={event}
      returnTo={(await searchParams).returnTo}
    />
  );
}
