import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { PaymentForm, type MembershipTier } from "@/features/memberships";
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

async function page({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = await params;
  const supabase = await createClient();

  const { data: membershipTier, error } = await supabase
    .from("membership_types")
    .select("*")
    .eq("id", tier)
    .single();

  if (error || !membershipTier) {
    notFound();
  }

  const tierData = membershipTier as MembershipTier;

  const formattedPrice = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(tierData.price);

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-10 max-w-5xl px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            asChild
            className="pl-0 hover:pl-2 transition-all"
          >
            <Link href="/memberships" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Memberships
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Membership Details Column */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {tierData.name}
              </h1>
              <div className="mt-2 text-2xl font-semibold text-primary">
                {formattedPrice}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  / year
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">About this membership</h3>
              <p className="text-muted-foreground leading-relaxed">
                {tierData.description || "No description available."}
              </p>
            </div>

            {tierData.features && tierData.features.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">What&apos;s included</h3>
                <ul className="space-y-3">
                  {tierData.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Payment Form Column */}
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

            <p className="text-xs text-center text-muted-foreground mt-6 px-4">
              By completing this purchase, you agree to our Terms of Service and
              Privacy Policy. All memberships are valid for one academic year.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default page;
