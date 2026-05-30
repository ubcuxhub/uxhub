import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentForm } from "@/features/memberships";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

async function page({
  params,
}: {
  params: Promise<{ membership: string }>;
}) {
  const { membership } = await params;
  const supabase = await createClient();

  const { data: membershipTier, error } = await supabase
    .from("membership_types")
    .select("*")
    .eq("id", membership)
    .single();

  if (error || !membershipTier) {
    notFound();
  }

  const tierData = membershipTier;

  const formattedPrice = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(tierData.price);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <Button
          variant="ghost"
          asChild
          className="pl-0 transition-all hover:pl-2"
        >
          <Link href="/portal/membership" className="flex items-center gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Memberships
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {tierData.name}
            </h1>
            <div className="mt-2 text-2xl font-semibold text-primary">
              {formattedPrice}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / year
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">About this membership</h3>
            <p className="leading-relaxed text-muted-foreground">
              {tierData.description || "No description available."}
            </p>
          </div>

          {tierData.features && tierData.features.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">What&apos;s included</h3>
              <ul className="space-y-3">
                {tierData.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="bg-muted/30 pb-6">
              <CardTitle>Secure Checkout</CardTitle>
              <CardDescription>
                Complete your purchase to join UX Hub
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <PaymentForm tier={tierData} />
            </CardContent>
          </Card>

          <p className="mt-6 px-4 text-center text-xs text-muted-foreground">
            By completing this purchase, you agree to our Terms of Service and
            Privacy Policy. All memberships are valid for one academic year.
          </p>
        </div>
      </div>
    </div>
  );
}

export default page;
