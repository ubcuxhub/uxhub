"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ApplicantInfoCard,
  ApplicationResponseCard,
  StatusUpdateSection,
} from "@/features/admin";
import { type ApplicationStatus, type EventRow } from "@/features/events";
import { createClient } from "@/lib/supabase/client";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import {
  fetchEventRegistrationById,
  updateEventRegistration,
} from "@/lib/supabase-helpers/event-registrations";
import { fetchApplicationResponsesForRegistration } from "@/lib/supabase-helpers/event-applications";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";
import { useUser } from "@/context/UserContext";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { SuccessOverlay } from "@/components/shared/SuccessOverlay";

interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: ApplicationStatus;
  created_at: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface ResponseWithQuestion {
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

export default function ApplicationReviewPage() {
  const params = useParams();
  const { user } = useUser();
  const eventId = params?.event as string;
  const registrationId = params?.registrationId as string;
  const supabase = useMemo(() => createClient(), []);

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [responses, setResponses] = useState<ResponseWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!registrationId || !eventId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch registration
        const registrationData = await fetchEventRegistrationById(
          supabase,
          registrationId
        );

        if (!registrationData) {
          throw new Error("Registration not found");
        }

        setRegistration(registrationData as unknown as Registration);

        // Fetch user info
        const userData = await fetchUserInfoContactById(
          supabase,
          registrationData.user_id
        );

        if (!userData) {
          throw new Error("User not found");
        }

        setUserInfo(userData);

        // Fetch event
        const eventData = await fetchEventById(
          supabase,
          registrationData.event_id
        );

        if (!eventData) {
          throw new Error("Event not found");
        }

        setEvent(eventData);

        // Fetch responses with joined questions
        const responsesData = await fetchApplicationResponsesForRegistration(
          supabase,
          registrationId
        );

        setResponses(responsesData as unknown as ResponseWithQuestion[]);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load application"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [registrationId, eventId, supabase]);

  const handleStatusUpdate = async (newStatus: ApplicationStatus) => {
    if (!registration || !user?.id || isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      await updateEventRegistration(supabase, registrationId, {
        status: newStatus,
        reviewer_id: user.id,
      });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !registration) {
    return (
      <PageContainer
        backHref={`/admin/events/${eventId}/review-applications`}
        backLabel="Back to Applications"
        className="flex flex-col gap-8"
      >
        <div className="rounded-lg border border-destructive/50 p-10 text-center text-sm text-destructive">
          {error}
        </div>
      </PageContainer>
    );
  }

  if (!registration || !userInfo || !event) {
    return null;
  }

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
