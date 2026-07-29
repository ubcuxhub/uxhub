import { FlowDialog } from "@/components/shared/FlowDialog";
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
    <FlowDialog
      title="Complete event registration"
      description="Review your ticket and check out securely."
      mode="canonical"
    >
      <EventCheckoutRoute
        slug={event}
        returnTo={(await searchParams).returnTo}
      />
    </FlowDialog>
  );
}
