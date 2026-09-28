"use client";

import { CheckoutLayout } from "@/components/shared/CheckoutLayout";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import { withReturnTo } from "@/lib/auth/paths";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

interface EventCheckoutProps {
  disabledMessage: string | null;
  event: EventRow;
  formattedDate: string | null;
  hasExistingRegistration: boolean;
  isDirectPurchaseEvent: boolean;
  returnTo?: string;
  slug: string;
  user: UserInfoRow;
}

export function EventCheckout({
  disabledMessage,
  event,
  formattedDate,
  hasExistingRegistration,
  isDirectPurchaseEvent,
  returnTo,
  slug,
  user,
}: EventCheckoutProps) {
  const { close } = useFlowDialog();
  const isMember = Boolean(user.membership_type_id);
  const price = isMember ? event.member_price : event.regular_price;

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
        disabled: !isDirectPurchaseEvent || hasExistingRegistration,
        disabledMessage,
        kind: "event_ticket",
        slug,
        successHref: confirmationHref,
      }}
      price={price}
      processingMessage="Please don’t close or refresh this page. We’re confirming your payment and event registration."
      user={user}
    />
  );
}
