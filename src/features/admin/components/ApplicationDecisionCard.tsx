"use client";

import { useId, useState } from "react";
import { CircleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DateTimeField,
  type DateTimeValue,
} from "@/components/ui/date-time-field";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  getApplicationDecisions,
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import {
  datetimeLocalToTimestamptz,
  formatTimestamp,
  timestamptzToDatetimeLocal,
} from "@/lib/date";

interface ApplicationDecisionCardProps {
  state: ApplicationReviewState;
  /** The applicant's first name, for the copy. */
  firstName: string;
  offerExpiresAt: string | null;
  /** The deadline offered when there is no current one (an accept from scratch). */
  defaultDeadline: DateTimeValue;
  /**
   * Makes the decision. Resolves when it is saved, throws when it is not; the
   * card shows a failure in place and keeps the form as it was.
   */
  onDecide: (
    decision: ApplicationDecision,
    offerExpiresAt: string | null
  ) => Promise<void>;
}

function describe(
  state: ApplicationReviewState,
  name: string,
  offerExpiresAt: string | null
): string {
  const deadline = formatTimestamp(offerExpiresAt);
  switch (state) {
    case "submitted":
      return `Accept ${name} with a deadline to register, waitlist, or reject.`;
    case "waitlisted":
      return `${name} is on the waitlist. Accept when a spot opens, or reject.`;
    case "accepted":
      return `${name} has until ${deadline} to register. Move the deadline, or take the offer back.`;
    case "offer_expired":
      return `${name}’s offer ran out${deadline ? ` on ${deadline}` : ""} without a registration. Offer again with a new deadline, or reject.`;
    case "registered":
      return `${name} registered, so the decision is final.`;
    case "rejected":
      return `${name} was rejected. The decision is final.`;
  }
}

export function decisionLabel(
  decision: ApplicationDecision,
  state: ApplicationReviewState
): string {
  if (decision === "accept") {
    if (state === "accepted") return "Move deadline";
    if (state === "offer_expired") return "Offer again";
    return "Accept";
  }
  if (decision === "reject") return state === "accepted" ? "Take back offer" : "Reject";
  return "Waitlist";
}

const isPast = (timestamp: string) => Date.parse(timestamp) <= Date.now();

const FAILED = "Couldn’t save the decision. Check your connection and try again.";

/**
 * The decision (docs/design/application-review.md, "Decision card"). Only the
 * pressed button shows a spinner; the rest are disabled while it saves. Reject
 * and Take back offer confirm first, since they can't be undone.
 */
export function ApplicationDecisionCard({
  state,
  firstName,
  offerExpiresAt,
  defaultDeadline,
  onDecide,
}: ApplicationDecisionCardProps) {
  const id = useId();
  const decisions = getApplicationDecisions(state);
  const [deadline, setDeadline] = useState<DateTimeValue>(() => {
    const local =
      state === "accepted" ? timestamptzToDatetimeLocal(offerExpiresAt) : "";
    if (!local) return defaultDeadline;
    const [date, time] = local.split("T");
    return {
      date: date as DateTimeValue["date"],
      time: time as DateTimeValue["time"],
    };
  });
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [pending, setPending] = useState<ApplicationDecision | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const chosen =
    deadline.date && deadline.time
      ? datetimeLocalToTimestamptz(`${deadline.date}T${deadline.time}`)
      : null;
  const [pastError, setPastError] = useState<string | null>(null);
  const timeError = deadlineError ?? pastError;

  const decide = async (decision: ApplicationDecision) => {
    if (decision === "accept" && chosen && isPast(chosen)) {
      setPastError("Pick a time in the future.");
      return;
    }
    setPending(decision);
    setFailure(null);
    try {
      await onDecide(decision, decision === "accept" ? chosen : null);
      setConfirmingReject(false);
    } catch {
      setFailure(FAILED);
    } finally {
      setPending(null);
    }
  };

  const takingBack = state === "accepted";

  return (
    <Card role="region" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle id={`${id}-title`} role="heading" aria-level={2}>
          Decision
        </CardTitle>
        <CardDescription>
          {describe(state, firstName, offerExpiresAt)}
        </CardDescription>
      </CardHeader>
      {decisions.length > 0 ? (
        <CardContent className="flex flex-col gap-5">
          {decisions.includes("accept") ? (
            <Field data-invalid={timeError ? true : undefined}>
              <FieldLabel htmlFor={`${id}-deadline`}>Register by</FieldLabel>
              <DateTimeField
                id={`${id}-deadline`}
                value={deadline}
                onValueChange={(value) => {
                  setPastError(null);
                  setDeadline(value);
                }}
                onValidityChange={setDeadlineError}
                dateLabel="Register by date"
                timeLabel="Register by time"
                disabled={pending !== null}
              />
              {timeError ? (
                <FieldError>{timeError}</FieldError>
              ) : (
                <FieldDescription>
                  Pacific Time. If {firstName} hasn’t registered by then, the
                  spot opens up again.
                </FieldDescription>
              )}
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {decisions.map((decision) => (
              <Button
                key={decision}
                variant={decision === "accept" ? "primary" : "secondary"}
                size="sm"
                loading={pending === decision}
                disabled={
                  (pending !== null && pending !== decision) ||
                  (decision === "accept" && (!chosen || Boolean(timeError)))
                }
                onClick={() =>
                  decision === "reject"
                    ? setConfirmingReject(true)
                    : void decide(decision)
                }
              >
                {decisionLabel(decision, state)}
              </Button>
            ))}
          </div>
          {failure && !confirmingReject ? (
            <p role="alert" className="text-small text-destructive">
              {failure}
            </p>
          ) : null}
        </CardContent>
      ) : null}
      <ConfirmDialog
        open={confirmingReject}
        onOpenChange={(open) => {
          if (pending === null) {
            setConfirmingReject(open);
            if (!open) setFailure(null);
          }
        }}
        icon={<CircleAlert aria-hidden />}
        title={
          takingBack
            ? `Take back ${firstName}’s offer?`
            : `Reject ${firstName}’s application?`
        }
        description={`${firstName} will see “Not selected” on the event page. You can’t undo this.`}
        cancelLabel="Keep reviewing"
        confirmLabel={takingBack ? "Take back offer" : "Reject"}
        pendingLabel={takingBack ? "Taking back…" : "Rejecting…"}
        pending={pending === "reject"}
        error={failure}
        onConfirm={() => void decide("reject")}
      />
    </Card>
  );
}
