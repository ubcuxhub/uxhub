import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CheckoutSummaryCardProps {
  amount: string;
  description: string;
  buttonLabel?: string;
}

export function CheckoutSummaryCard({
  amount,
  description,
  buttonLabel = "Secure Checkout",
}: CheckoutSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Secure Checkout</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="font-semibold">{amount}</span>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Payments are not enabled on this page yet. This screen is currently a
          preview of the checkout flow.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled>
          {buttonLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
