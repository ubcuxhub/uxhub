"use client";

import { useState } from "react";
import {
  ApplicantInfoCard,
} from "@/features/admin/components/ApplicantInfoCard";
import {
  ApplicationResponseCard,
} from "@/features/admin/components/ApplicationResponseCard";
import {
  StatusUpdateSection,
} from "@/features/admin/components/StatusUpdateSection";
import type { EventApplicationRow, EventRow } from "@/lib/supabase/models";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";
import { updateApplicationDecisionAction } from "@/features/admin/actions";
import {
  getApplicationReviewState,
  type ApplicationDecision,
} from "@/features/admin/lib/application-review";
import { formatUserName } from "@/lib/user-name";

export interface AdminApplicationUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface AdminApplicationResponse {
  id: string;
  application_id: string;
  event_application_question_id: string;
  response: string;
  created_at: string;
  event_application_questions: {
    id: string;
    question: string;
    response_type: string;
    max_char_limit: number | null;
    response_options: string[] | null;
  } | null;
}

interface ApplicationReviewClientProps {
  application: EventApplicationRow;
  hasTicket: boolean;
  userInfo: AdminApplicationUser;
  event: EventRow;
  responses: AdminApplicationResponse[];
}

const SUCCESS_MESSAGES: Record<ApplicationDecision, string> = {
  accept: "Offer sent",
  waitlist: "Application waitlisted",
  reject: "Application rejected",
};

export function ApplicationReviewClient({
  application: initialApplication,
  hasTicket,
  userInfo,
  event,
  responses,
}: ApplicationReviewClientProps) {
  const [application, setApplication] =
    useState<EventApplicationRow>(initialApplication);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const state = getApplicationReviewState(application, hasTicket);

  const handleDecision = async (
    decision: ApplicationDecision,
    offerExpiresAt: string | null
  ) => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      setApplication(
        await updateApplicationDecisionAction(
          application.id,
          decision,
          offerExpiresAt
        )
      );
      setSuccessMessage(SUCCESS_MESSAGES[decision]);
    } catch (err) {
      console.error("Error updating status:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update application status"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <PageContainer
        backHref="/admin/events"
        backLabel="Back to Events"
        className="flex flex-col gap-8"
      >
            {/* Header */}
            <div>
              <h1 className="text-h2">Application Review</h1>
              <p className="mt-1 text-small text-muted-foreground">
                {event.name}
              </p>
            </div>

            {/* Applicant Information */}
            <ApplicantInfoCard
              name={formatUserName(userInfo)}
              email={userInfo.email}
              applicationDate={application.created_at}
              state={state}
              offerExpiresAt={application.offer_expires_at}
            />

            {/* Application Responses */}
            <div className="space-y-4">
              <div>
                <h2 className="text-h3">Application Responses</h2>
                <p className="mt-1 text-small text-muted-foreground">
                  Review the applicant&apos;s responses to the application
                  questions
                </p>
              </div>

              {responses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-small text-muted-foreground">
                      No application responses found.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {responses.map((response) => {
                    const question = response.event_application_questions;
                    if (!question) return null;

                    return (
                      <ApplicationResponseCard
                        key={response.id}
                        question={question.question}
                        response={response.response}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status Update Section */}
            <StatusUpdateSection
              state={state}
              isUpdating={isUpdating}
              onDecision={handleDecision}
              error={error}
            />
      </PageContainer>

      {/* Success Overlay */}
      {successMessage && (
        <SuccessOverlay
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </>
  );
}
