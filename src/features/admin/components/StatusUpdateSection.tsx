"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  getApplicationDecisions,
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import { datetimeLocalToTimestamptz } from "@/lib/date";
import { Check, Clock, X } from "lucide-react";

interface StatusUpdateSectionProps {
  state: ApplicationReviewState;
  isUpdating: boolean;
  onDecision: (
    decision: ApplicationDecision,
    offerExpiresAt: string | null
  ) => void;
  error: string | null;
}

const DECISION_LABELS: Record<ApplicationDecision, string> = {
  accept: "Accept",
  waitlist: "Waitlist",
  reject: "Reject",
};

function describeState(state: ApplicationReviewState) {
  switch (state) {
    case "submitted":
      return "Accept with an offer deadline, waitlist, or reject this application.";
    case "waitlisted":
      return "Accept with an offer deadline, or reject this application.";
    case "accepted":
      return "Set a new deadline, or take the offer back before they register.";
    case "offer_expired":
      return "The offer expired without a registration. Re-offer with a new deadline, or reject.";
    case "registered":
      return "This applicant has registered, so the decision is final.";
    case "rejected":
      return "This application was rejected. The decision is final.";
  }
}

export function StatusUpdateSection({
  state,
  isUpdating,
  onDecision,
  error,
}: StatusUpdateSectionProps) {
  const decisions = getApplicationDecisions(state);
  const [deadline, setDeadline] = useState("");
  const offerExpiresAt = datetimeLocalToTimestamptz(deadline);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Application Status</CardTitle>
        <CardDescription>{describeState(state)}</CardDescription>
      </CardHeader>
      {decisions.length > 0 && (
        <CardContent className="space-y-4">
          {decisions.includes("accept") && (
            <Field>
              <FieldLabel htmlFor="offer_expires_at">
                Offer deadline (Pacific)
              </FieldLabel>
              <Input
                id="offer_expires_at"
                type="datetime-local"
                value={deadline}
                disabled={isUpdating}
                aria-describedby="offer_expires_at_description"
                onChange={(event) => setDeadline(event.target.value)}
              />
              <FieldDescription id="offer_expires_at_description">
                The applicant must register by this time, or the seat opens up
                again.
              </FieldDescription>
            </Field>
          )}

          <div className="flex gap-4">
            {decisions.map((decision) => (
              <Button
                key={decision}
                variant={
                  decision === "reject"
                    ? "destructive"
                    : decision === "waitlist"
                      ? "outline"
                      : "default"
                }
                onClick={() =>
                  onDecision(
                    decision,
                    decision === "accept" ? offerExpiresAt : null
                  )
                }
                disabled={isUpdating || (decision === "accept" && !offerExpiresAt)}
                className={
                  decision === "accept"
                    ? "flex-1 bg-success hover:bg-success/90"
                    : "flex-1"
                }
              >
                {isUpdating ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    {decision === "accept" && <Check className="mr-2" />}
                    {decision === "waitlist" && <Clock className="mr-2" />}
                    {decision === "reject" && <X className="mr-2" />}
                    {decision === "accept" && state !== "submitted" && state !== "waitlisted"
                      ? "Re-offer"
                      : decision === "reject" && state === "accepted"
                        ? "Take back offer"
                        : DECISION_LABELS[decision]}
                  </>
                )}
              </Button>
            ))}
          </div>

          {error && <p className="text-small text-destructive">{error}</p>}
        </CardContent>
      )}
    </Card>
  );
}
