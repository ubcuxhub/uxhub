import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SquareCheckoutForm } from "@/features/payments";
import type { PurchaseKind } from "@/features/payments";

interface CheckoutPaymentSectionProps {
  amount: string;
  amountCents: number;
  collectBuyerDetails?: boolean;
  description?: string;
  buttonLabel?: string;
  disabled?: boolean;
  disabledMessage?: string | null;
  framed?: boolean;
  initialEmail: string;
  initialName: string;
  initialPhone?: string | null;
  kind: PurchaseKind;
  slug: string;
  successHref?: string | ((purchaseId: string) => string);
  onSubmittingChange?: (submitting: boolean) => void;
  showAmount?: boolean;
  showSecurityMessage?: boolean;
  title?: string;
}

export function CheckoutPaymentSection({
  amount,
  amountCents,
  collectBuyerDetails = true,
  description,
  buttonLabel = "Secure Checkout",
  disabled = false,
  disabledMessage = null,
  framed = true,
  initialEmail,
  initialName,
  initialPhone,
  kind,
  slug,
  successHref,
  onSubmittingChange,
  showAmount = true,
  showSecurityMessage = true,
  title = "Secure Checkout",
}: CheckoutPaymentSectionProps) {
  const form = (
    <SquareCheckoutForm
      amountCents={amountCents}
      amountLabel={amount}
      buttonLabel={buttonLabel}
      collectBuyerDetails={collectBuyerDetails}
      disabled={disabled}
      disabledMessage={disabledMessage}
      initialEmail={initialEmail}
      initialName={initialName}
      initialPhone={initialPhone}
      kind={kind}
      slug={slug}
      successHref={successHref}
      onSubmittingChange={onSubmittingChange}
      showAmount={showAmount}
      showSecurityMessage={showSecurityMessage}
    />
  );

  if (!framed) {
    return (
      <section className="space-y-6" aria-labelledby="payment-details-heading">
        <div>
          <h2 id="payment-details-heading" className="text-subheading">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-small text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          {form}
          <p className="text-small text-muted-foreground">
            Square securely processes your payment details. UX Hub confirms
            pricing, eligibility, and fulfillment before purchase.
          </p>
        </div>
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className="text-small text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showAmount ? (
          <>
            <div className="flex items-center justify-between text-small">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold">{amount}</span>
            </div>
            <Separator />
          </>
        ) : null}
        {form}
      </CardContent>
      <CardFooter className="pt-0 text-small text-muted-foreground">
        Square securely processes your payment details. UX Hub confirms pricing,
        eligibility, and fulfillment before purchase.
      </CardFooter>
    </Card>
  );
}
