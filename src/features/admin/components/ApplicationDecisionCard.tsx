"use client";

import { useId, useState } from "react";
import {
  CalendarClock,
  Check,
  CircleAlert,
  Hourglass,
  Info,
  Lock,
  Minus,
  RotateCcw,
  Undo2,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  acceptTakesSeat,
  getApplicationDecisions,
  type ApplicationDecision,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import {
  datetimeLocalToTimestamptz,
  formatEventDate,
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
   * When decisions are released, while that is still ahead; `null` once
   * applicants can see them. Until then any decision can change, and an
   * offer's deadline must fall after it.
   */
  releaseAt?: string | null;
  /**
   * A waitlisted applicant's place (1 for the earliest application) and when
   * they applied. Absent, the note doesn't number them.
   */
  waitlist?: { position: number; appliedAt: string } | null;
  /** The event's capacity; null or absent when it has none. */
  capacity?: number | null;
  /**
   * Seats left (capacity less tickets and held offers); null when there is no
   * capacity. At 0 the card says so before an accept that would take a seat.
   * The server still checks, and an accept over capacity asks to confirm.
   */
  openSeats?: number | null;
  /**
   * Makes the decision. Resolves when it is saved, or with a message when the
   * server refused it; throws when it could not be saved. The card shows
   * either in place and keeps the form as it was.
   */
  onDecide: (
    decision: ApplicationDecision,
    offerExpiresAt: string | null
  ) => Promise<string | void>;
}

type NoteTone = "neutral" | "info" | "locked";

const NOTE_ICON: Record<NoteTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  locked: Lock,
};

/**
 * The note's tone: Locked once nothing can change, Info while an offer or a
 * waitlist place is live with the applicant, Neutral otherwise.
 */
function noteTone(state: ApplicationReviewState, unreleased: boolean): NoteTone {
  if (state === "registered") return "locked";
  if (unreleased) return "neutral";
  if (state === "rejected") return "locked";
  if (state === "accepted" || state === "waitlisted") return "info";
  return "neutral";
}

const spots = (count: number) =>
  `${count} ${count === 1 ? "spot is" : "spots are"} open.`;

function describe(
  state: ApplicationReviewState,
  name: string,
  offerExpiresAt: string | null,
  unreleased: boolean,
  waitlist: { position: number; appliedAt: string } | null,
  open: number | null
): string {
  const deadline = formatTimestamp(offerExpiresAt);
  if (state === "waitlisted" && waitlist) {
    const applied = formatEventDate(waitlist.appliedAt, {
      month: "short",
      year: undefined,
    });
    return [
      `${name} is #${waitlist.position} on the waitlist (applied ${applied}).`,
      open ? spots(open) : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (unreleased) {
    if (state === "accepted") {
      return `${name} is accepted, with until ${deadline} to register. You can change this until decisions are released.`;
    }
    if (state === "rejected") {
      return `${name} is marked as rejected. You can change this until decisions are released.`;
    }
  }
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

/**
 * A decision's button label. Accepting someone off the waitlist once
 * decisions are out is "Offer spot": the same accept, worded for a spot
 * opening up.
 */
export function decisionLabel(
  decision: ApplicationDecision,
  state: ApplicationReviewState,
  released = true
): string {
  if (decision === "accept") {
    if (state === "accepted") return "Move deadline";
    if (state === "offer_expired") return "Offer again";
    if (state === "waitlisted" && released) return "Offer spot";
    return "Accept";
  }
  if (decision === "reject") return state === "accepted" ? "Take back offer" : "Reject";
  return "Waitlist";
}

const DECISION_ICON: Record<string, LucideIcon> = {
  Accept: Check,
  "Offer spot": UserCheck,
  "Move deadline": CalendarClock,
  "Offer again": RotateCcw,
  Waitlist: Hourglass,
  Reject: Minus,
  "Take back offer": Undo2,
};

/** Secondary actions first, in this order; the accept is the primary, last. */
const SECONDARY_ORDER: readonly ApplicationDecision[] = ["reject", "waitlist"];

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
  releaseAt = null,
  waitlist = null,
  capacity = null,
  openSeats = null,
  onDecide,
}: ApplicationDecisionCardProps) {
  const id = useId();
  const unreleased = Boolean(releaseAt);
  const decisions = getApplicationDecisions(state, !unreleased);
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
    if (decision === "accept" && chosen && releaseAt && Date.parse(chosen) <= Date.parse(releaseAt)) {
      setPastError("Pick a time after decisions are released.");
      return;
    }
    setPending(decision);
    setFailure(null);
    try {
      const refusal = await onDecide(decision, decision === "accept" ? chosen : null);
      if (refusal) setFailure(refusal);
      else setConfirmingReject(false);
    } catch {
      setFailure(FAILED);
    } finally {
      setPending(null);
    }
  };

  const takingBack = state === "accepted";
  const tone = noteTone(state, unreleased);
  const NoteIcon = NOTE_ICON[tone];
  const full =
    openSeats === 0 && decisions.includes("accept") && acceptTakesSeat(state);
  const secondary = SECONDARY_ORDER.filter((decision) => decisions.includes(decision));
  const primary = decisions.includes("accept") ? ("accept" as const) : null;

  const button = (decision: ApplicationDecision) => {
    const label = decisionLabel(decision, state, !unreleased);
    const Icon = DECISION_ICON[label];
    return (
      <Button
        key={decision}
        variant={decision === "accept" ? "primary" : "secondary"}
        className={decision === "accept" ? "ml-auto" : undefined}
        loading={pending === decision}
        disabled={
          (pending !== null && pending !== decision) ||
          (decision === "accept" && (!chosen || Boolean(timeError)))
        }
        onClick={() =>
          decision === "reject" ? setConfirmingReject(true) : void decide(decision)
        }
      >
        {Icon ? <Icon aria-hidden /> : null}
        {label}
      </Button>
    );
  };

  return (
    <Card role="region" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle id={`${id}-title`} role="heading" aria-level={2}>
          Decision
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Alert
            variant={tone === "info" ? "info" : "neutral"}
            icon={<NoteIcon aria-hidden />}
            data-tone={tone}
          >
            <p>
              {describe(state, firstName, offerExpiresAt, unreleased, waitlist, openSeats)}
            </p>
            {releaseAt ? (
              <p className="mt-1">
                {`Hidden from ${firstName} until ${formatTimestamp(releaseAt)}.`}
              </p>
            ) : null}
          </Alert>
          {full ? (
            <Alert variant="neutral" icon={<Users aria-hidden />}>
              {capacity
                ? `All ${capacity} spots are held, so accepting ${firstName} goes over capacity.`
                : `No spots are left, so accepting ${firstName} goes over capacity.`}{" "}
              Take back an offer or raise the capacity in the event builder to make room.
            </Alert>
          ) : null}
        </div>
        {decisions.length > 0 ? (
          <>
            {primary ? (
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
            <div
              role="group"
              aria-label="Decide"
              className="flex flex-wrap items-center gap-2"
            >
              {secondary.map(button)}
              {primary ? button(primary) : null}
            </div>
            {failure && !confirmingReject ? (
              <p role="alert" className="text-small text-destructive">
                {failure}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
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
        description={
          unreleased
            ? `${firstName} will see “Not selected” on the event page once decisions are released. You can change this until then.`
            : `${firstName} will see “Not selected” on the event page. You can’t undo this.`
        }
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
