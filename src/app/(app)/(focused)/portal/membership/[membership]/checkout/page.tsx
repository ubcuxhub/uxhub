import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutSummaryCard } from "@/components/shared/CheckoutSummaryCard";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTypeBySlug } from "@/lib/supabase-helpers/memberships";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

interface MembershipCheckoutPageProps {
  params: Promise<{ membership: string }>;
}

export default async function MembershipCheckoutPage({
  params,
}: MembershipCheckoutPageProps) {
  const { membership: plan } = await params;
  const user = await requireAuth();
  const supabase = await createClient();
  const membershipType = await fetchMembershipTypeBySlug(supabase, plan);

  if (!membershipType) {
    notFound();
  }

  const formattedPrice = formatCurrency(membershipType.price);
  const amountCents = Math.round(membershipType.price * 100);
  const hasMembership = Boolean(
    user.membership_type_id || user.membership_pre_ordered_type_id
  );
  const disabledMessage = hasMembership
    ? "Your account already has an active or pending membership."
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <Badge variant="secondary">Annual Membership</Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl">{membershipType.name}</CardTitle>
                <p className="text-2xl font-semibold text-primary">
                  {formattedPrice}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {membershipType.description}
              </p>
              {membershipType.features && membershipType.features.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="font-medium">Included</h2>
                  <ul className="space-y-2">
                    {membershipType.features.map((feature) => (
                      <li
                        key={feature}
                        className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <CheckoutSummaryCard
            amount={formattedPrice}
            amountCents={amountCents}
            description={`Review your ${membershipType.name} membership purchase.`}
            buttonLabel="Purchase Membership"
            disabled={hasMembership}
            disabledMessage={disabledMessage}
            initialEmail={user.email}
            initialName={user.name}
            initialPhone={user.phone}
            kind="membership"
            slug={membershipType.slug}
          />
        </div>
      </div>
    </div>
  );
}
