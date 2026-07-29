"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { CheckoutPaymentSection } from "@/components/shared/CheckoutPaymentSection";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventRow, UserInfoRow } from "@/types/models";

interface EventCheckoutProps {
  disabledMessage: string | null;
  event: EventRow;
  formattedDate: string | null;
  hasExistingRegistration: boolean;
  isDirectPurchaseEvent: boolean;
  slug: string;
  user: UserInfoRow;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export function EventCheckout({
  disabledMessage,
  event,
  formattedDate,
  hasExistingRegistration,
  isDirectPurchaseEvent,
  slug,
  user,
}: EventCheckoutProps) {
  const { close, setBusy } = useFlowDialog();
  const [processing, setProcessing] = useState(false);
  const isMember = Boolean(user.membership_type_id);
  const price = isMember ? event.member_price : event.regular_price;
  const formattedPrice = formatCurrency(price);

  const handleSubmittingChange = (submitting: boolean) => {
    setProcessing(submitting);
    setBusy(submitting);
  };

  const eventDetails = [
    formattedDate,
    event.location_building,
    isMember && event.member_price !== event.regular_price
      ? "Member price applied"
      : null,
  ].filter(Boolean);

  return (
    <div className="min-h-full">
      {processing ? (
        <div className="flex min-h-full items-center justify-center text-center">
          <div className="max-w-md">
            <LoaderCircle className="mx-auto size-12 animate-spin text-primary" />
            <h1 className="mt-6 text-h2">Processing your payment</h1>
            <p className="mt-2 text-small text-muted-foreground">
              Please don’t close or refresh this page. We’re confirming your
              payment and event registration.
            </p>
          </div>
        </div>
      ) : null}

      <div className={cn("flex min-h-full flex-col", processing && "hidden")}>
        <div>
          <h1 className="text-h2">Checkout</h1>
          <p className="mt-2 text-small text-muted-foreground">
            Review your ticket for {event.name}.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CheckoutPaymentSection
            amount={formattedPrice}
            amountCents={Math.round(price * 100)}
            collectBuyerDetails={false}
            buttonLabel="Pay now"
            disabled={!isDirectPurchaseEvent || hasExistingRegistration}
            disabledMessage={disabledMessage}
            framed={false}
            initialEmail={user.email}
            initialName={user.name}
            initialPhone={user.phone}
            kind="event_ticket"
            slug={slug}
            onSubmittingChange={handleSubmittingChange}
            showAmount={false}
            showSecurityMessage={false}
            title="Payment details"
          />

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{event.name}</p>
                  {eventDetails.length > 0 ? (
                    <p className="mt-1 text-small text-muted-foreground">
                      {eventDetails.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <p className="font-medium">{formattedPrice}</p>
              </div>
              {event.description ? (
                <p className="whitespace-pre-wrap text-small text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t pt-4 text-subheading">
                <span>Total</span>
                <span>{formattedPrice}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-auto pt-8">
          <Button onClick={close} variant="outline">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
