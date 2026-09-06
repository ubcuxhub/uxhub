"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { TriangleAlert } from "lucide-react";

import { FlowLink } from "@/components/shared/FlowLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MembershipTypeRow, UserType } from "@/types/models";
import { cn } from "@/lib/utils";
import { withReturnTo } from "@/lib/auth/paths";
import { formatEventDate } from "@/lib/date";
import { membershipDetailsPath } from "@/features/memberships/lib/policy";

export function MembershipPlans({
  expiresAt,
  membershipTiers,
  returnTo,
  userType,
}: {
  /**
   * Set only when the club-wide term end shortens these memberships to less
   * than a year. Repeated on the checkout screen, which single-tier users reach
   * without passing through here.
   */
  expiresAt?: string | null;
  membershipTiers: MembershipTypeRow[];
  returnTo?: string;
  userType: UserType;
}) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const continueToCheckout = () => {
    if (!selectedSlug) return;
    router.replace(
      withReturnTo(
        `/portal/membership/${selectedSlug}/checkout`,
        returnTo ?? "/portal",
      ),
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <h1 className="text-h2">Choose your membership</h1>
        <p className="mt-2 text-small text-muted-foreground">
          Select the option that works best for you.
        </p>
      </div>

      {expiresAt ? (
        <Alert className="mt-6" icon={<TriangleAlert className="size-4" />}>
          <AlertTitle>
            These memberships end {formatEventDate(expiresAt) ?? "soon"}.
          </AlertTitle>
          <AlertDescription>
            UX Hub memberships all expire at the end of the current term, not
            one year from the day you buy them.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-4">
        {membershipTiers.map((tier) => {
          const selected = selectedSlug === tier.slug;
          const price = new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency: "CAD",
          }).format(tier.price);

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedSlug(tier.slug)}
              className={cn(
                "rounded-lg border p-5 text-left transition-colors hover:bg-accent",
                selected && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              <span className="font-medium">{tier.name}</span>
              <span className="mt-2 block text-h2 text-primary">{price}</span>
              <span className="mt-2 block text-small text-muted-foreground">
                {tier.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between gap-4 pt-8">
        <Button asChild variant="outline">
          <FlowLink
            href={withReturnTo(
              membershipDetailsPath(userType),
              returnTo ?? "/portal",
            )}
            replace
          >
            Back
          </FlowLink>
        </Button>
        <Button disabled={!selectedSlug} onClick={continueToCheckout}>
          Next
        </Button>
      </div>
    </div>
  );
}
