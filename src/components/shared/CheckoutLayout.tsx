"use client";

import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

import { CheckoutPaymentSection } from "@/components/shared/CheckoutPaymentSection";
import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PurchaseKind } from "@/features/payments/types";
import type { UserInfoRow } from "@/lib/supabase/models";
import { cn } from "@/lib/utils";

interface CheckoutLayoutProps {
  /** Rendered in the footer, typically a "Back" button. */
  backAction: ReactNode;
  /** Subtitle under the "Checkout" heading. */
  description: string;
  item: {
    name: string;
    /** One line under the item name, e.g. date and location. */
    details?: string | null;
    description?: string | null;
  };
  /** Shown above the payment form, e.g. a warning the buyer should read first. */
  notice?: ReactNode;
  payment: {
    disabled?: boolean;
    disabledMessage?: string | null;
    kind: PurchaseKind;
    slug: string;
    successHref: (purchaseId: string) => string;
  };
  /** Price in dollars. */
  price: number;
  /** Shown under the spinner while the payment is being confirmed. */
  processingMessage: string;
  user: UserInfoRow;
}

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

/**
 * Shared frame for every checkout dialog: heading, payment form, order summary,
 * footer, and the processing screen shown while a payment is confirmed. Callers
 * supply only what differs per purchase kind.
 */
export function CheckoutLayout({
  backAction,
  description,
  item,
  notice,
  payment,
  price,
  processingMessage,
  user,
}: CheckoutLayoutProps) {
  const { setBusy } = useFlowDialog();
  const [processing, setProcessing] = useState(false);
  const formattedPrice = currency.format(price);

  const handleSubmittingChange = (submitting: boolean) => {
    setProcessing(submitting);
    setBusy(submitting);
  };

  return (
    <div className="flex min-h-full flex-col">
      {processing ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div className="max-w-md">
            <LoaderCircle className="mx-auto size-12 animate-spin text-primary" />
            <h1 className="mt-6 text-h2">Processing your payment</h1>
            <p className="mt-2 text-small text-muted-foreground">
              {processingMessage}
            </p>
          </div>
        </div>
      ) : null}

      {/* Hidden rather than unmounted, so the Square form survives processing. */}
      <div className={cn("flex flex-1 flex-col", processing && "hidden")}>
        <div>
          <h1 className="text-h2">Checkout</h1>
          <p className="mt-2 text-small text-muted-foreground">{description}</p>
        </div>

        {notice ? <div className="mt-6">{notice}</div> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CheckoutPaymentSection
            amount={formattedPrice}
            amountCents={Math.round(price * 100)}
            collectBuyerDetails={false}
            buttonLabel="Pay now"
            disabled={payment.disabled}
            disabledMessage={payment.disabledMessage}
            framed={false}
            initialEmail={user.email}
            initialFirstName={user.first_name}
            initialLastName={user.last_name}
            initialPhone={user.phone}
            kind={payment.kind}
            slug={payment.slug}
            successHref={payment.successHref}
            onSubmittingChange={handleSubmittingChange}
            showAmount={false}
            showSecurityMessage={false}
            title="Payment details"
            userId={user.id}
          />

          <Card className="self-start">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.details ? (
                    <p className="mt-1 text-small text-muted-foreground">
                      {item.details}
                    </p>
                  ) : null}
                </div>
                <p className="font-medium">{formattedPrice}</p>
              </div>
              {item.description ? (
                <p className="whitespace-pre-wrap text-small text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t pt-4 text-subheading">
                <span>Total</span>
                <span>{formattedPrice}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-auto pt-8">{backAction}</div>
      </div>
    </div>
  );
}
