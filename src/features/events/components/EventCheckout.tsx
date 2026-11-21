"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  STAFF_TEST_REGISTRATION_LABEL,
  STAFF_TEST_REGISTRATION_WARNING,
  allowsStaffTestRegistration,
  isDraftEvent,
} from "@/features/events/lib/event-visibility";
import { CheckoutLayout } from "@/components/shared/CheckoutLayout";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth/user-context";
import { hasActiveMembership } from "@/features/memberships/lib/expiry";
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
  const isMember = event.pricing_policy === "figma"
    ? hasActiveMembership(user, membershipTermEndsAt)
    : Boolean(user.membership_type_id);
  const price = isMember ? event.member_price : event.regular_price;

  if (price === null) return <Alert>Registration is unavailable until event pricing is configured.</Alert>;
  // Only staff can see a draft (RLS). They may test-register on a free one;
  // a paid draft shows no button, since the database refuses it.
  const staffTest = isDraftEvent(event);
  if (staffTest && !allowsStaffTestRegistration(event)) {
    return <Alert>Paid drafts can’t be test-registered. Make the event free to test registration, or publish it.</Alert>;
  }

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
      notice={staffTest ? (
        <Alert>
          <AlertTitle>{STAFF_TEST_REGISTRATION_LABEL}</AlertTitle>
          <AlertDescription>{STAFF_TEST_REGISTRATION_WARNING}</AlertDescription>
        </Alert>
      ) : undefined}
      item={{
        name: event.name,
        details: eventDetails.join(" · "),
        description: event.description,
      }}
      payment={{
        disabled: disabledMessage !== null,
        disabledMessage,
        freeButtonLabel: staffTest ? STAFF_TEST_REGISTRATION_LABEL : undefined,
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
