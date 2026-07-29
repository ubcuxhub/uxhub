"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { CheckoutPaymentSection } from "@/components/shared/CheckoutPaymentSection";
import { FlowLink } from "@/components/shared/FlowLink";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserInfoRow, MembershipTypeRow } from "@/types/models";
import { withReturnTo } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

export function MembershipCheckout({
  backHref,
  membershipType,
  returnTo,
  user,
}: {
  backHref: string;
  membershipType: MembershipTypeRow;
  returnTo?: string;
  user: UserInfoRow;
}) {
  const { setBusy } = useFlowDialog();
  const [processing, setProcessing] = useState(false);
  const formattedPrice = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(membershipType.price);

  const handleSubmittingChange = (submitting: boolean) => {
    setProcessing(submitting);
    setBusy(submitting);
  };

  const confirmationHref = (purchaseId: string) =>
    withReturnTo(
      `/portal/membership/confirmation/${purchaseId}`,
      returnTo ?? "/portal",
    );

  return (
    <div className="min-h-full">
      {processing ? (
        <div className="flex min-h-full items-center justify-center text-center">
          <div className="max-w-md">
            <LoaderCircle className="mx-auto size-12 animate-spin text-primary" />
            <h1 className="mt-6 text-h2">Processing your payment</h1>
            <p className="mt-2 text-small text-muted-foreground">
              Please don’t close or refresh this page. We’re confirming your
              payment, eligibility, and membership details.
            </p>
          </div>
        </div>
      ) : null}

      <div className={cn("flex min-h-full flex-col", processing && "hidden")}>
        <div>
          <h1 className="text-h2">Checkout</h1>
          <p className="mt-2 text-small text-muted-foreground">
            Review your purchase for the {membershipType.name} membership.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CheckoutPaymentSection
            amount={formattedPrice}
            amountCents={Math.round(membershipType.price * 100)}
            collectBuyerDetails={false}
            buttonLabel="Pay now"
            framed={false}
            initialEmail={user.email}
            initialName={user.name}
            initialPhone={user.phone}
            kind="membership"
            slug={membershipType.slug}
            successHref={confirmationHref}
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
                  <p className="font-medium">{membershipType.name}</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    {user.user_type === "ubcStudent"
                      ? "UBC Student"
                      : user.user_type === "faculty"
                        ? "UBC Faculty"
                        : "Non-UBC"}
                  </p>
                </div>
                <p className="font-medium">{formattedPrice}</p>
              </div>
              <p className="text-small text-muted-foreground">
                {membershipType.description}
              </p>
              <div className="flex items-center justify-between border-t pt-4 text-subheading">
                <span>Total</span>
                <span>{formattedPrice}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-auto pt-8">
          <Button asChild variant="outline">
            <FlowLink
              href={withReturnTo(backHref, returnTo ?? "/portal")}
              replace
            >
              Back
            </FlowLink>
          </Button>
        </div>
      </div>
    </div>
  );
}
