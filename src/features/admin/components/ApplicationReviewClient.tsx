"use client";

import { useState } from "react";
import {
  ApplicantInfoCard,
  ApplicationResponseCard,
  StatusUpdateSection,
} from "@/features/admin";
import type { ApplicationStatus, EventRow } from "@/types/models";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";
import { updateApplicationStatusAction } from "@/features/admin/actions";

export interface AdminApplicationRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface AdminApplicationUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminApplicationResponse {
  id: string;
  event_registration_id: string;
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
  eventId: string;
  registration: AdminApplicationRegistration;
  userInfo: AdminApplicationUser;
  event: EventRow;
  responses: AdminApplicationResponse[];
}

export function ApplicationReviewClient({
  eventId,
  registration: initialRegistration,
  userInfo,
  event,
  responses,
}: ApplicationReviewClientProps) {
  const registrationId = initialRegistration.id;
  const [registration, setRegistration] =
    useState<AdminApplicationRegistration>(initialRegistration);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStatusUpdate = async (newStatus: ApplicationStatus) => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      await updateApplicationStatusAction(registrationId, newStatus);

      // Update local state
      setRegistration({ ...registration, status: newStatus });

      // Show success message
      let message = "";
      switch (newStatus) {
        case "accepted":
          message = "Application accepted";
          break;
        case "declined":
          message = "Application declined";
          break;
        case "pending":
          message = "Application reopened for review";
          break;
      }

      setSuccessMessage(message);
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
        backHref={`/admin/events/${eventId}/review-applications`}
        backLabel="Back to Applications"
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
              applicationDate={registration.created_at}
              status={registration.status}
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
                        response={response.response}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status Update Section */}
            <StatusUpdateSection
              currentStatus={registration.status}
              isUpdating={isUpdating}
              onStatusUpdate={handleStatusUpdate}
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
