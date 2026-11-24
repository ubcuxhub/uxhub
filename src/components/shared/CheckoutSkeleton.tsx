import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A checkout dialog's content while it loads, shaped like `CheckoutLayout`:
 * the heading, the payment column (as a paid checkout, with the card field),
 * the order summary, and the Back button, as static blocks (Portal Motion
 * handoff §2f). The dialog frame around it is real.
 */
export function CheckoutSkeleton() {
  return (
    <div className="flex min-h-full flex-col" aria-busy="true">
      <span role="status" className="sr-only">
        Loading checkout
      </span>

      {/* "Checkout" and its subtitle. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-3.5 w-72 max-w-full rounded-full" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Payment details: title, Square card field, security line, Pay now. */}
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4.5 w-36 rounded-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-full sm:h-10" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-[75%] rounded-full" />
            </div>
          </div>
        </div>

        {/* Order summary: item and price, description, total. */}
        <Card className="self-start">
          <CardHeader>
            <Skeleton className="h-4.5 w-32 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-[65%] rounded-full" />
                <Skeleton className="h-3 w-[85%] rounded-full" />
              </div>
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-[55%] rounded-full" />
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle pt-4">
              <Skeleton className="h-4.5 w-12 rounded-full" />
              <Skeleton className="h-4.5 w-16 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back. */}
      <div className="mt-auto pt-8">
        <Skeleton className="h-11 w-20 rounded-full sm:h-10" />
      </div>
    </div>
  );
}
