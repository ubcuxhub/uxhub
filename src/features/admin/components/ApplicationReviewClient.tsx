"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

import { BackButton } from "@/components/shared/BackButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import { Avatar } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DateTimeValue } from "@/components/ui/date-time-field";
import { toast } from "@/components/ui/toast";
import { updateApplicationDecisionAction } from "@/features/admin/actions";
import { ApplicantPager, type PagerTarget } from "@/features/admin/components/ApplicantPager";
import {
  ApplicantProfileCard,
  type ApplicantProfile,
} from "@/features/admin/components/ApplicantProfileCard";
import { ApplicationDecisionCard } from "@/features/admin/components/ApplicationDecisionCard";
import { ReviewStateBadge } from "@/features/admin/components/ReviewStateBadge";
import {
  decisionsReleased,
  getApplicationReviewState,
  openSeats,
  type ApplicationDecision,
} from "@/features/admin/lib/application-review";
import { ApplicationAnswersReadOnly } from "@/features/applications/components/ApplicationAnswersReadOnly";
import type {
  ApplicationAnswers,
  ApplicationQuestion,
} from "@/features/applications/lib/application-form";
import { formatEventDate, formatTimestamp } from "@/lib/date";
import type { SubmittedApplicationRow } from "@/lib/supabase/models";
import type { DecisionSeats } from "@/lib/supabase-helpers/event-applications";

export type AdminApplicant = ApplicantProfile;

interface ApplicationReviewClientProps {
  eventName: string;
  application: SubmittedApplicationRow;
  hasTicket: boolean;
  applicant: AdminApplicant;
  questions: ApplicationQuestion[];
  answers: ApplicationAnswers;
  /** Signed download links for file answers, by question id. */
  fileLinks?: Record<string, string>;
  /** The list the reviewer came from, with its query and this row's page. */
  backHref: string;
  pager: {
    position: number;
    total: number;
    scope: string;
    previous: PagerTarget | null;
    next: PagerTarget | null;
  };
  defaultDeadline: DateTimeValue;
  /** The event's "Release decisions on", null when none is set. */
  decisionsReleaseAt?: string | null;
  /** The event's capacity, null when it has none. */
  capacity?: number | null;
  /** What holds seats when the page loaded: tickets and unexpired offers. */
  seats?: { tickets: number; heldOffers: number } | null;
  /** Their place on the waitlist when the page loaded, if waitlisted. */
  waitlistPosition?: number | null;
  /**
   * The reviewer-notes thread. It sits in the aside under the decision (and
   * after it on one column), where the notes inform the decision and are read
   * beside the answers. Nothing renders until it is given.
   */
  notes?: ReactNode;
}

const firstName = (name: string) => name.split(" ")[0] || name;

const count = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

/** "38 of 40 seats are held: 30 going, 8 offers out." */
export function describeHeldSeats(seats: DecisionSeats): string {
  const held = seats.tickets + seats.heldOffers;
  return `${held} of ${count(seats.capacity ?? held, "seat is", "seats are")} held: ${seats.tickets} going, ${count(seats.heldOffers, "offer", "offers")} out.`;
}

/**
 * One application (docs/design/application-review.md, §3): the applicant, the
 * answers, and an aside with their profile, the decision and room for reviewer
 * notes. Two columns when the content area is wide enough (container query,
 * since the admin shell has a sidebar); DOM order equals visual order at every
 * width.
 */
export function ApplicationReviewClient({
  eventName,
  application: initialApplication,
  hasTicket,
  applicant,
  questions,
  answers,
  fileLinks = {},
  backHref,
  pager,
  defaultDeadline,
  decisionsReleaseAt = null,
  capacity = null,
  seats = null,
  waitlistPosition = null,
  notes,
}: ApplicationReviewClientProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [application, setApplication] =
    useState<SubmittedApplicationRow>(initialApplication);
  const state = getApplicationReviewState(application, hasTicket);
  const name = firstName(applicant.name);
  const releaseAt = decisionsReleased(decisionsReleaseAt) ? null : decisionsReleaseAt;
  // The seat counts are from the page load. This applicant's own decisions
  // move them: an unexpired offer holds a seat, taking it back frees one.
  const heldAtLoad = getApplicationReviewState(initialApplication, hasTicket) === "accepted";
  const holdsSeat = state === "accepted";
  const open = openSeats(
    capacity,
    seats
      ? {
          tickets: seats.tickets,
          heldOffers: seats.heldOffers + Number(holdsSeat) - Number(heldAtLoad),
        }
      : null
  );
  const waitlistedAtLoad = initialApplication.status === "waitlisted";
  // An accept the event has no seat for, waiting on "Accept anyway".
  const [overCapacity, setOverCapacity] = useState<{
    offerExpiresAt: string | null;
    seats: DecisionSeats;
  } | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // A new applicant is a new page: focus the name, so moving to the next one
  // is announced.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const decide = async (
    decision: ApplicationDecision,
    offerExpiresAt: string | null,
    allowOverCapacity = false
  ): Promise<string | void> => {
    let result: Awaited<ReturnType<typeof updateApplicationDecisionAction>>;
    try {
      result = await updateApplicationDecisionAction(
        application.id,
        decision,
        offerExpiresAt,
        { allowOverCapacity }
      );
    } catch (error) {
      console.error("Error updating application decision:", error);
      throw error;
    }
    if (!result.ok) {
      if (result.reason === "OVER_CAPACITY") {
        setOverrideError(null);
        setOverCapacity({ offerExpiresAt, seats: result.seats });
        return;
      }
      return result.error;
    }
    const updated = result.application;
    setApplication(updated);
    setOverCapacity(null);
    const next = pager.next;
    toast.success(
      decision === "accept"
        ? `${name} accepted`
        : decision === "waitlist"
          ? `${name} waitlisted`
          : `${name} rejected`,
      {
        description:
          decision === "accept"
            ? `${result.overCapacity ? "Over capacity. " : ""}Register by ${formatTimestamp(updated.offer_expires_at)}`
            : undefined,
        action: next
          ? { label: "Next applicant", onClick: () => router.push(next.href) }
          : undefined,
      }
    );
  };

  const acceptAnyway = async () => {
    if (!overCapacity) return;
    setOverriding(true);
    setOverrideError(null);
    try {
      const refusal = await decide("accept", overCapacity.offerExpiresAt, true);
      if (refusal) setOverrideError(refusal);
    } catch {
      setOverrideError("Couldn’t save the decision. Check your connection and try again.");
    } finally {
      setOverriding(false);
    }
  };

  return (
    <PageContainer className="@container flex flex-col gap-8">
      <BackButton
        link={backHref}
        label="Back to applications"
        className="-mb-2 w-fit"
      />

      <header className="flex flex-col gap-5 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={applicant.name} size={56} decorative />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {/* Under the event manager's h1, the event's name. */}
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-h2 outline-none"
              >
                {applicant.name}
              </h2>
              <ReviewStateBadge state={state} />
            </div>
            <p className="text-small text-muted-foreground">
              Submitted{" "}
              {formatEventDate(application.submitted_at ?? application.created_at, {
                month: "short",
              })}
            </p>
          </div>
        </div>
        <ApplicantPager
          position={pager.position}
          total={pager.total}
          scope={pager.scope}
          previous={pager.previous}
          next={pager.next}
          className="shrink-0"
        />
      </header>

      <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <Card role="region" aria-labelledby="application-answers">
          <CardHeader>
            <CardTitle id="application-answers" role="heading" aria-level={2}>
              Answers
            </CardTitle>
            <CardDescription>
              {eventName} application · {questions.length}{" "}
              {questions.length === 1 ? "question" : "questions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {questions.length === 0 ? (
              <p className="text-small text-muted-foreground">
                This application has no questions.
              </p>
            ) : (
              <ApplicationAnswersReadOnly
                questions={questions}
                answers={answers}
                fileLinks={fileLinks}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <ApplicantProfileCard
            applicant={applicant}
            submittedAt={application.submitted_at ?? application.created_at}
            showIdentity={false}
          />
          <ApplicationDecisionCard
            key={state}
            state={state}
            firstName={name}
            offerExpiresAt={application.offer_expires_at}
            defaultDeadline={defaultDeadline}
            releaseAt={releaseAt}
            waitlist={
              state === "waitlisted" && waitlistedAtLoad && waitlistPosition
                ? {
                    position: waitlistPosition,
                    appliedAt: application.submitted_at ?? application.created_at,
                  }
                : null
            }
            capacity={capacity}
            openSeats={open}
            onDecide={(decision, offerExpiresAt) => decide(decision, offerExpiresAt)}
          />
          {notes}
        </div>
      </div>

      <ConfirmDialog
        open={overCapacity !== null}
        onOpenChange={(open) => {
          if (!open && !overriding) setOverCapacity(null);
        }}
        icon={<Users aria-hidden />}
        title="This event is full"
        description={
          overCapacity
            ? `${describeHeldSeats(overCapacity.seats)} Accepting ${name} holds one more seat than the event has.`
            : undefined
        }
        cancelLabel="Don’t accept"
        confirmLabel="Accept anyway"
        pendingLabel="Accepting…"
        confirmVariant="default"
        pending={overriding}
        error={overrideError}
        onConfirm={() => void acceptAnyway()}
      />
    </PageContainer>
  );
}
