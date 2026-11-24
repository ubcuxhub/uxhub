import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SquareCheckoutForm,
} from "@/features/payments/components/SquareCheckoutForm";
import type { PurchaseKind } from "@/features/payments/types";

interface CheckoutPaymentSectionProps {
  amount: string;
  amountCents: number;
  description?: string;
  buttonLabel?: string;
  /** The submit label for a free ticket or membership, which takes no card. */
  freeButtonLabel?: string;
  disabled?: boolean;
  disabledMessage?: string | null;
  framed?: boolean;
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone?: string | null;
  kind: PurchaseKind;
  slug: string;
  successHref?: string | ((purchaseId: string) => string);
  onSubmittingChange?: (submitting: boolean) => void;
  showAmount?: boolean;
  showSecurityMessage?: boolean;
  title?: string;
  userId: string;
}

export function CheckoutPaymentSection({
  amount,
  amountCents,
  description,
  buttonLabel = "Secure Checkout",
  freeButtonLabel,
  disabled = false,
  disabledMessage = null,
  framed = true,
  initialEmail,
  initialFirstName,
  initialLastName,
  initialPhone,
  kind,
  slug,
  successHref,
  onSubmittingChange,
  showAmount = true,
  showSecurityMessage = true,
  title = "Secure Checkout",
  userId,
}: CheckoutPaymentSectionProps) {
  const free = amountCents === 0;
  const securityMessage = free && kind === "event_ticket"
    ? "Your eligibility and available capacity are checked before your ticket is confirmed."
    : free
      ? "Your eligibility is checked before your membership starts."
      : "Square securely processes your payment details. UX Hub confirms pricing, eligibility, and fulfillment before purchase.";
  const form = (
    <SquareCheckoutForm
      amountCents={amountCents}
      amountLabel={amount}
      buttonLabel={buttonLabel}
      freeButtonLabel={freeButtonLabel}
      disabled={disabled}
      disabledMessage={disabledMessage}
      initialEmail={initialEmail}
      initialFirstName={initialFirstName}
      initialLastName={initialLastName}
      initialPhone={initialPhone}
      kind={kind}
      slug={slug}
      successHref={successHref}
      onSubmittingChange={onSubmittingChange}
      showAmount={showAmount}
      showSecurityMessage={showSecurityMessage}
      userId={userId}
    />
  );

  if (!framed) {
    return (
      <section className="space-y-6" aria-label={title}>
        <div>
          <h2 className="text-subheading">
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
            {securityMessage}
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
              <span className="text-muted-foreground">Total amount</span>
              <span className="text-body-medium">{amount}</span>
            </div>
            <Separator />
          </>
        ) : null}
        {form}
      </CardContent>
      <CardFooter className="pt-0 text-small text-muted-foreground">
        {securityMessage}
      </CardFooter>
    </Card>
  );
}
