"use client";

import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { useUser } from "@/lib/auth/user-context";
import {
  PurchaseConfirmation,
  STALLED_BODY,
  failureBody,
  type ConfirmationCopy,
  type ConfirmationState,
} from "@/features/payments/components/PurchaseConfirmation";

const VIEW_PURCHASES = { href: "/portal#settings/purchases", label: "View purchases" };
const BACK_TO_MEMBERSHIP = { href: "/portal/membership", label: "Back to membership" };

export function MembershipConfirmation({
  purchase,
}: {
  purchase: PurchaseWithDetails;
}) {
  const { refreshUser } = useUser();
  const tier = purchase.membership_types?.name ?? "UX Hub";

  const copy = (state: ConfirmationState): ConfirmationCopy => {
    switch (state) {
      case "completed":
        return {
          title: "Membership confirmed",
          body: purchase.confirmation_email_sent_at
            ? `Your ${tier} membership is now active. A confirmation email has been sent to your inbox.`
            : `Your ${tier} membership is now active.`,
          // A completed purchase makes /portal/membership a dead end: the plans
          // route sees the new membership and renders "You're already a
          // member". Those users go to the portal.
          action: { href: "/portal", label: "Go to portal" },
        };
      case "refunded":
        return {
          title: "Payment refunded",
          body: `This ${tier} membership payment was refunded in full. Check your purchases for details.`,
          action: VIEW_PURCHASES,
        };
      case "failed":
        return { title: "Payment wasn’t completed", body: failureBody(purchase), action: BACK_TO_MEMBERSHIP };
      case "stalled":
        return { title: "Membership is still processing", body: STALLED_BODY, action: VIEW_PURCHASES };
      case "pending":
        return {
          title: "Membership processing",
          body: "We’re still confirming your payment and membership details.",
          action: BACK_TO_MEMBERSHIP,
        };
    }
  };

  return (
    <PurchaseConfirmation
      purchase={purchase}
      copy={copy}
      onCompleted={() => void refreshUser()}
    />
  );
}
