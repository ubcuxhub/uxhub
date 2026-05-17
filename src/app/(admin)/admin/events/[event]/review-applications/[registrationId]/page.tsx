"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AdminPageSkeleton,
  AdminSidebar,
  ApplicantInfoCard,
  ApplicationResponseCard,
  StatusUpdateSection,
} from "@/features/admin";
import { ProtectedRoute } from "@/features/auth";
import { type ApplicationStatus, type Event } from "@/features/events";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/shared/BackButton";
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
  const [event, setEvent] = useState<Event | null>(null);
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
        const { data: registrationData, error: regError } = await supabase
          .from("event_registrations")
          .select("*")
          .eq("id", registrationId)
          .maybeSingle();

        if (regError) {
          throw new Error(`Failed to fetch registration: ${regError.message}`);
        }

        if (!registrationData) {
          throw new Error("Registration not found");
        }

        setRegistration(registrationData as Registration);

        // Fetch user info
        const { data: userData, error: userError } = await supabase
          .from("user_info")
          .select("id, name, email")
          .eq("id", registrationData.user_id)
          .maybeSingle();

        if (userError) {
          throw new Error(`Failed to fetch user info: ${userError.message}`);
        }

        if (!userData) {
          throw new Error("User not found");
        }

        setUserInfo(userData);

        // Fetch event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", registrationData.event_id)
          .maybeSingle();

        if (eventError) {
          throw new Error(`Failed to fetch event: ${eventError.message}`);
        }

        if (!eventData) {
          throw new Error("Event not found");
        }

        setEvent(eventData as Event);

        // Fetch responses with joined questions
        const { data: responsesData, error: responsesError } = await supabase
          .from("event_application_responses")
          .select(
            `
            *,
            event_application_questions (
              id,
              question,
              response_type,
              max_char_limit,
              response_options
            )
          `
          )
          .eq("event_registration_id", registrationId)
          .order("created_at", { ascending: true });

        if (responsesError) {
          throw new Error(
            `Failed to fetch responses: ${responsesError.message}`
          );
        }

        setResponses((responsesData || []) as ResponseWithQuestion[]);
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
      const { error: updateError } = await supabase
        .from("event_registrations")
        .update({
          status: newStatus,
          reviewer_id: user.id,
        })
        .eq("id", registrationId);

      if (updateError) {
        throw new Error(`Failed to update status: ${updateError.message}`);
      }

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
      <ProtectedRoute admin loadingFallback={<AdminPageSkeleton />}>
        <div className="flex h-screen">
          <AdminSidebar />
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error && !registration) {
    return (
      <ProtectedRoute admin loadingFallback={<AdminPageSkeleton />}>
        <div className="flex h-screen">
          <AdminSidebar />
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-8 px-8">
              <div className="rounded-lg border border-destructive/50 p-10 text-center text-sm text-destructive">
                {error}
              </div>
              <Button asChild variant="outline">
                <Link
                  href={`/admin/events/${eventId}/review-applications?filter=pending`}
                >
                  Back to Applications
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!registration || !userInfo || !event) {
    return null;
  }

  return (
    <ProtectedRoute admin loadingFallback={<AdminPageSkeleton />}>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-8 px-8">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Application Review</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {event.name}
                </p>
              </div>
              <BackButton
                link={`/admin/events/${eventId}/review-applications?filter=pending`}
                label="Back to Applications"
                className="w-fit"
              />
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
          </div>
        </div>
      </div>

      {/* Success Overlay */}
      {successMessage && (
        <SuccessOverlay
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </ProtectedRoute>
  );
}
