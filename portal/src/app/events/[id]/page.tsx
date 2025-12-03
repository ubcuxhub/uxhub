"use client";

import { useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { EventApplicationForm } from "@/components/EventApplicationForm";
import { EventDetailsCard } from "@/components/EventDetailsCard";
import { EventStatusCard } from "@/components/EventStatusCard";
import { MessageCard } from "@/components/MessageCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { useEventDetail } from "@/hooks/useEventDetail";
import { useEventApplication } from "@/hooks/useEventApplication";
import { BackButton } from "@/components/BackButton";

export default function EventDetailPage() {
  const params = useParams();
  const { user, loading: userLoading, refreshUser } = useUser();
  const eventId = params?.id as string;

  const {
    event,
    questions,
    loading,
    error,
    hasApplied,
    registrationId,
  } = useEventDetail(eventId, user, userLoading);

  const {
    isSubmitting,
    error: submitError,
    successMessage,
    submitApplication,
  } = useEventApplication(refreshUser);

  const handleSubmitApplication = async (
    responses: Record<string, string | string[]>
  ) => {
    if (!event) {
      return;
    }

    await submitApplication(eventId, responses, user, registrationId);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto max-w-4xl py-10">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error && !event) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto max-w-4xl py-10">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
              <BackButton link="/events" label="Back to Events" className="mt-4" />
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-7xl py-10 space-y-6">
        <BackButton link="/events" label="Back to Events" />

        {/* Side-by-side layout: Event Details and Application Form */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Event Details Card */}
          <div className="space-y-6">
            <EventDetailsCard event={event} />
            <EventStatusCard
              hasApplied={hasApplied}
              hasQuestions={questions.length > 0}
            />
          </div>

          {/* Application Form - Right Side */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <EventApplicationForm
                eventId={eventId}
                questions={questions}
                onSubmit={handleSubmitApplication}
                isSubmitting={isSubmitting}
              />
              {submitError && <MessageCard type="error" message={submitError} />}
              {successMessage && (
                <MessageCard type="success" message={successMessage} />
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

