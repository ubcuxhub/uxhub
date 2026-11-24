"use client";

import { Alert } from "@/components/ui/alert";
import {
  PAID_DRAFT_REGISTRATION_REASON,
  draftTakesRegistrations,
  isDraftEvent,
} from "@/features/events/lib/event-visibility";
import { CheckoutLayout } from "@/components/shared/CheckoutLayout";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth/user-context";
import { eventPriceFor } from "@/features/events/lib/event-rules";
import { withReturnTo } from "@/lib/auth/paths";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

interface EventCheckoutProps {
  disabledMessage: string | null;
  event: EventRow;
  formattedDate: string | null;
  returnTo?: string;
  slug: string;
  user: UserInfoRow;
}

export function EventCheckout({
  disabledMessage,
  event,
  formattedDate,
  returnTo,
  slug,
  user,
}: EventCheckoutProps) {
  const { close } = useFlowDialog();
  const { membershipTermEndsAt } = useUser();
  const { amount: price, isMember } = eventPriceFor(event, user, membershipTermEndsAt);

  if (price === null) return <Alert>Registration is unavailable until event pricing is configured.</Alert>;
  // Only admins and managers can see a draft (RLS), and they get the same
  // checkout a member gets on the published event. The database refuses a
  // paid draft, so its checkout shows disabled and never loads the card form.
  const blockedMessage =
    disabledMessage ??
    (isDraftEvent(event) && !draftTakesRegistrations(event) ? PAID_DRAFT_REGISTRATION_REASON : null);

  const confirmationHref = (purchaseId: string) =>
    withReturnTo(
      `/portal/events/${slug}/confirmation/${purchaseId}`,
      returnTo ?? "/portal",
    );

  const eventDetails = [
    formattedDate,
    event.location_building,
    isMember && event.member_price !== event.regular_price
      ? "Member price applied"
      : null,
  ].filter(Boolean);

  return (
    <CheckoutLayout
      backAction={
        <Button onClick={close} variant="outline">
          Back
        </Button>
      }
      description={`Review your ticket for ${event.name}.`}
      item={{
        name: event.name,
        details: eventDetails.join(" · "),
        description: event.description,
      }}
      payment={{
        disabled: blockedMessage !== null,
        disabledMessage: blockedMessage,
        kind: "event_ticket",
        slug,
        successHref: confirmationHref,
      }}
      price={price}
      processingMessage={price === 0 ? "Please don’t close or refresh this page. We’re confirming your event registration." : "Please don’t close or refresh this page. We’re confirming your payment and event registration."}
      user={user}
    />
  );
}
