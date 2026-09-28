"use client";

import { Info } from "lucide-react";

import { CheckoutLayout } from "@/components/shared/CheckoutLayout";
import { FlowLink } from "@/components/shared/FlowLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { UserInfoRow, MembershipTypeRow } from "@/lib/supabase/models";
import { withReturnTo } from "@/lib/auth/paths";
import { formatEventDate } from "@/lib/date";

export function MembershipCheckout({
  backHref,
  expiresAt,
  membershipType,
  returnTo,
  user,
}: {
  backHref: string;
  /**
   * Set only when the club-wide term end shortens this membership to less than
   * a year, in which case the buyer is warned before they pay.
   */
  expiresAt?: string | null;
  membershipType: MembershipTypeRow;
  returnTo?: string;
  user: UserInfoRow;
}) {
  const confirmationHref = (purchaseId: string) =>
    withReturnTo(
      `/portal/membership/confirmation/${purchaseId}`,
      returnTo ?? "/portal",
    );

  return (
    <CheckoutLayout
      backAction={
        <Button asChild variant="outline">
          <FlowLink
            href={withReturnTo(backHref, returnTo ?? "/portal")}
            replace
          >
            Back
          </FlowLink>
        </Button>
      }
      description={`Review your purchase for the ${membershipType.name} membership.`}
      item={{
        name: membershipType.name,
        details:
          user.user_type === "ubcStudent"
            ? "UBC Student"
            : user.user_type === "faculty"
              ? "UBC Faculty"
              : "Non-UBC",
        description: membershipType.description,
      }}
      notice={
        expiresAt ? (
          <Alert icon={<Info className="size-4" />} variant="info">
            <AlertTitle>
              This membership ends {formatEventDate(expiresAt) ?? "soon"}.
            </AlertTitle>
            <AlertDescription>
              Memberships are valid until the end of the current school year.
            </AlertDescription>
          </Alert>
        ) : null
      }
      payment={{
        kind: "membership",
        slug: membershipType.slug,
        successHref: confirmationHref,
      }}
      price={membershipType.price}
      processingMessage="Please don’t close or refresh this page. We’re confirming your payment, eligibility, and membership details."
      user={user}
    />
  );
}
