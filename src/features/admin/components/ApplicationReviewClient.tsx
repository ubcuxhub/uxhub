"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/BackButton";
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
import { ApplicationDecisionCard } from "@/features/admin/components/ApplicationDecisionCard";
import { ReviewStateBadge } from "@/features/admin/components/ReviewStateBadge";
import {
  getApplicationReviewState,
  type ApplicationDecision,
} from "@/features/admin/lib/application-review";
import { ApplicationAnswersReadOnly } from "@/features/applications/components/ApplicationAnswersReadOnly";
import type {
  ApplicationAnswers,
  ApplicationQuestion,
} from "@/features/applications/lib/application-form";
import { formatTimestamp } from "@/lib/date";
import type { SubmittedApplicationRow } from "@/lib/supabase/models";

export interface AdminApplicant {
  name: string;
  email: string;
  program: string | null;
}

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
  /**
   * The reviewer-notes thread. It sits in the aside under the decision (and
   * after it on one column), where the notes inform the decision and are read
   * beside the answers. Nothing renders until it is given.
   */
  notes?: ReactNode;
}

const firstName = (name: string) => name.split(" ")[0] || name;

/**
 * One application (docs/design/application-review.md, §3): the applicant, the
 * answers, the decision, and room for reviewer notes. Two columns when the
 * content area is wide enough (container query, since the admin shell has a
 * sidebar); DOM order equals visual order at every width.
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
  notes,
}: ApplicationReviewClientProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [application, setApplication] =
    useState<SubmittedApplicationRow>(initialApplication);
  const state = getApplicationReviewState(application, hasTicket);
  const name = firstName(applicant.name);

  // A new applicant is a new page: focus the name, so moving to the next one
  // is announced.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const decide = async (
    decision: ApplicationDecision,
    offerExpiresAt: string | null
  ) => {
    let updated: SubmittedApplicationRow;
    try {
      updated = await updateApplicationDecisionAction(
        application.id,
        decision,
        offerExpiresAt
      );
    } catch (error) {
      console.error("Error updating application decision:", error);
      throw error;
    }
    setApplication(updated);
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
            ? `Register by ${formatTimestamp(updated.offer_expires_at)}`
            : undefined,
        action: next
          ? { label: "Next applicant", onClick: () => router.push(next.href) }
          : undefined,
      }
    );
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
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-h2 outline-none"
              >
                {applicant.name}
              </h1>
              <ReviewStateBadge state={state} />
            </div>
            <p className="text-small text-muted-foreground">
              {applicant.program ? `${applicant.program} · ` : null}
              <a
                href={`mailto:${applicant.email}`}
                className="text-info-foreground underline-offset-4 hover:underline focus-visible:focus-ring"
              >
                {applicant.email}
              </a>
            </p>
            <p className="text-small text-muted-foreground">
              Submitted{" "}
              {formatTimestamp(application.submitted_at ?? application.created_at)}
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
          <ApplicationDecisionCard
            key={state}
            state={state}
            firstName={name}
            offerExpiresAt={application.offer_expires_at}
            defaultDeadline={defaultDeadline}
            onDecide={decide}
          />
          {notes}
        </div>
      </div>
    </PageContainer>
  );
}
