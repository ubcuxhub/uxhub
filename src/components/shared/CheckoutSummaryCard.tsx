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

interface CheckoutSummaryCardProps {
  amount: string;
  amountCents: number;
  description: string;
  buttonLabel?: string;
  disabled?: boolean;
  disabledMessage?: string | null;
  initialEmail: string;
  initialName: string;
  initialPhone?: string | null;
  kind: PurchaseKind;
  slug: string;
  successHref?: string;
}

export function CheckoutSummaryCard({
  amount,
  amountCents,
  description,
  buttonLabel = "Secure Checkout",
  disabled = false,
  disabledMessage = null,
  initialEmail,
  initialName,
  initialPhone,
  kind,
  slug,
  successHref,
}: CheckoutSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Secure Checkout</CardTitle>
        <p className="text-small text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-small">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="font-semibold">{amount}</span>
        </div>
        <Separator />
        <SquareCheckoutForm
          amountCents={amountCents}
          amountLabel={amount}
          buttonLabel={buttonLabel}
          disabled={disabled}
          disabledMessage={disabledMessage}
          initialEmail={initialEmail}
          initialName={initialName}
          initialPhone={initialPhone}
          kind={kind}
          slug={slug}
          successHref={successHref}
        />
      </CardContent>
      <CardFooter className="pt-0 text-small text-muted-foreground">
        Square secures the payment details while UX Hub controls pricing,
        membership eligibility, and ticket fulfillment on the server.
      </CardFooter>
    </Card>
  );
}
