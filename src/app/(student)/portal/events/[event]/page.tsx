"use client";

import { useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  EventDetailsCard,
  EventStatusCard,
  EventApplicationForm,
  useEventApplication,
  useEventDetail,
} from "@/features/events";
import { MessageCard } from "@/components/shared/MessageCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/shared/BackButton";

export default function EventDetailPage() {
  const params = useParams();
  const { user, loading: userLoading, refreshUser } = useUser();
  const eventSlug = params?.event as string;

  const {
    event,
    questions,
    loading,
    error,
    hasApplied,
    registrationId,
  } = useEventDetail(eventSlug, user, userLoading);

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

    await submitApplication(event.id, responses, user, registrationId);
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <BackButton
              link="/portal"
              label="Back to portal homepage"
              className="mt-4"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-10">
      <BackButton link="/portal" label="Back to portal homepage" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <EventDetailsCard event={event} />
          <EventStatusCard
            hasApplied={hasApplied}
            hasQuestions={questions.length > 0}
          />
        </div>

        {questions.length > 0 ? (
          <div className="space-y-4">
            <EventApplicationForm
              eventId={event.id}
              questions={questions}
              onSubmit={handleSubmitApplication}
              isSubmitting={isSubmitting}
            />
            {submitError ? <MessageCard type="error" message={submitError} /> : null}
            {successMessage ? (
              <MessageCard type="success" message={successMessage} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
