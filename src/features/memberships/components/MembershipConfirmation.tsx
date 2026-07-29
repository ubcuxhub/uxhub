"use client";

import { useEffect, useRef } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

import { useFlowDialog } from "@/components/shared/FlowDialog";
import { Button } from "@/components/ui/button";
import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { useUser } from "@/context/UserContext";

export function MembershipConfirmation({
  purchase,
}: {
  purchase: PurchaseWithDetails;
}) {
  const { close } = useFlowDialog();
  const { refreshUser } = useUser();
  const refreshedUser = useRef(false);
  const completed = purchase.status === "completed";
  const failed = purchase.status === "failed" || purchase.status === "canceled";

  useEffect(() => {
    if (completed && !refreshedUser.current) {
      refreshedUser.current = true;
      void refreshUser();
    }
  }, [completed, refreshUser]);

  return (
    <div className="flex min-h-full items-center justify-center text-center">
      <div className="max-w-lg">
        {completed ? (
          <Check className="mx-auto size-16 rounded-full bg-success/10 p-3 text-success" />
        ) : failed ? (
          <CircleAlert className="mx-auto size-16 rounded-full bg-destructive/10 p-3 text-destructive" />
        ) : (
          <LoaderCircle className="mx-auto size-16 animate-spin text-primary" />
        )}
        <h1 className="mt-6 text-h1">
          {completed
            ? "Membership confirmed"
            : failed
              ? "Payment wasn’t completed"
              : "Membership processing"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {completed
            ? `Your ${purchase.membership_types?.name ?? "UX Hub"} membership is now active. A confirmation email has been sent to your inbox.`
            : failed
              ? purchase.failure_reason ?? "Your payment could not be completed."
              : "We’re still confirming your payment and membership details."}
        </p>
        <Button className="mt-8" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}
