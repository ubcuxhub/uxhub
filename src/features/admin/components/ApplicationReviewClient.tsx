"use client";

import { useState } from "react";
import {
  ApplicantInfoCard,
  ApplicationResponseCard,
  StatusUpdateSection,
} from "@/features/admin";
import type {
  ApplicationStatus,
  EventApplicationRow,
  EventRow,
} from "@/types/models";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";
import {
  markApplicationNotAttendingAction,
  reviewApplicationAction,
} from "@/features/admin/actions";
import type { ApplicationResponseWithQuestion } from "@/lib/supabase-helpers/event-applications";
import type { UserInfoContact } from "@/lib/supabase-helpers/users";

interface ApplicationReviewClientProps {
  application: EventApplicationRow;
  userInfo: UserInfoContact;
  reviewerInfo: UserInfoContact | null;
  currentAdmin: UserInfoContact;
  event: EventRow;
  responses: ApplicationResponseWithQuestion[];
}

export function ApplicationReviewClient({
  application: initialApplication,
  userInfo,
  reviewerInfo,
  currentAdmin,
  event,
  responses,
}: ApplicationReviewClientProps) {
  const [application, setApplication] =
    useState<EventApplicationRow>(initialApplication);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const displayedReviewer =
    application.reviewer_id === reviewerInfo?.id
      ? reviewerInfo
      : application.reviewer_id === currentAdmin.id
        ? currentAdmin
        : null;

  const handleDecision = async (
    newStatus: Extract<ApplicationStatus, "accepted" | "rejected">
  ) => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const updated = await reviewApplicationAction(application.id, newStatus);
      setApplication(updated);
      setSuccessMessage(
        newStatus === "accepted"
          ? "Application accepted"
          : "Application rejected"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update application status"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotAttending = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const updated = await markApplicationNotAttendingAction(application.id);
      setApplication(updated);
      setSuccessMessage("Applicant marked as not attending");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update attendance"
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
              <h1 className="text-2xl font-semibold">Application Review</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {event.name}
              </p>
            </div>

            {/* Applicant Information */}
            <ApplicantInfoCard
              name={userInfo.name}
              email={userInfo.email}
              application={application}
              reviewer={displayedReviewer}
            />

            {/* Application Responses */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Application Responses</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Review the applicant&apos;s responses to the application
                  questions
                </p>
              </div>

              {responses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
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
                        response={response.response ?? ""}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status Update Section */}
            <StatusUpdateSection
              application={application}
              isUpdating={isUpdating}
              onDecision={handleDecision}
              onMarkNotAttending={handleNotAttending}
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
