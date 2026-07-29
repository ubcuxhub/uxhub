"use client";

import Link from "next/link";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
} from "@/types/models";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { BackButton } from "@/components/shared/BackButton";
import { useEventForm } from "@/features/admin/hooks/useEventForm";
import { BasicEventInfo } from "./event-form/BasicEventInfo";
import { EventPricing } from "./event-form/EventPricing";
import { EventLocation } from "./event-form/EventLocation";
import { EventSchedule } from "./event-form/EventSchedule";
import { RegistrationTimes } from "./event-form/RegistrationTimes";
import { CheckInEventsSection } from "./event-form/CheckInEventsSection";
import { ApplicationQuestionsSection } from "./event-form/ApplicationQuestionsSection";
import { EventFormSkeleton } from "./event-form/EventFormSkeleton";
import { DeleteEventModal } from "./DeleteEventModal";

interface EventCreateModifyProps {
  eventId?: string;
  initialEvent?: EventRow | null;
  initialCheckInSessions?: CheckInSessionRow[];
  initialApplicationQuestions?: EventApplicationQuestionRow[];
  onSuccess?: (id: string) => void;
  title?: string;
  description?: string;
}

export const EventCreateModify = ({
  eventId,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  onSuccess,
  title,
  description,
}: EventCreateModifyProps) => {
  const form = useEventForm({
    eventId,
    initialEvent,
    initialCheckInSessions,
    initialApplicationQuestions,
    onSuccess,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <h2 className="text-subheading">
            {title ?? (eventId ? "Modify Event" : "Create Event")}
          </h2>
          <p className="text-small text-muted-foreground">
            {description ??
              (eventId
                ? "Update the details for this event."
                : "Provide the details for the new event.")}
          </p>
        </div>
        {eventId && (
          <div className="flex flex-col gap-2 md:ml-4 md:flex-row">
            <Button type="button" variant="outline" asChild>
              <Link href={`/admin/events/${eventId}/check-in`}>Check-In</Link>
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={`/admin/events/${eventId}/review-applications`}>
                Review Applications
              </Link>
            </Button>
            <BackButton link="/admin/events" label="Back to Events" />
          </div>
        )}
      </div>

      {form.loadingEvent ? (
        <EventFormSkeleton />
      ) : (
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit}>
          <BasicEventInfo
            name={form.formState.name}
            description={form.formState.description}
            max_capacity={form.formState.max_capacity}
            image_url={form.formState.image_url}
            isSubmitting={form.isSubmitting}
            onImageFileChange={form.setPendingImageFile}
            onFieldChange={form.handleFieldChange}
          />
          <EventPricing
            regular_price={form.formState.regular_price}
            member_price={form.formState.member_price}
            onFieldChange={form.handleFieldChange}
          />
          <EventSchedule
            start_date={form.formState.start_date}
            start_time={form.formState.start_time}
            end_date={form.formState.end_date}
            end_time={form.formState.end_time}
            onFieldChange={form.handleFieldChange}
          />
          <EventLocation
            location_building={form.formState.location_building}
            location_room={form.formState.location_room}
            location_address_url={form.formState.location_address_url}
            onFieldChange={form.handleFieldChange}
          />
          <RegistrationTimes
            registration_start_time={form.formState.registration_start_time}
            registration_end_time={form.formState.registration_end_time}
            onFieldChange={form.handleFieldChange}
          />
          <CheckInEventsSection
            checkInEvents={form.checkInEvents}
            onAdd={form.addCheckInEvent}
            onRemove={form.removeCheckInEvent}
            onUpdate={form.updateCheckInEvent}
          />
          <ApplicationQuestionsSection
            applicationTemplate={form.applicationTemplate}
            questionErrors={form.questionErrors}
            onAdd={form.addApplicationQuestion}
            onRemove={form.removeApplicationQuestion}
            onUpdate={form.updateApplicationQuestion}
            onAddResponseOption={form.addResponseOption}
            onUpdateResponseOption={form.updateResponseOption}
            onRemoveResponseOption={form.removeResponseOption}
            onResponseTypeChange={form.handleResponseTypeChange}
          />
          {form.error && (
            <Field data-invalid>
              <FieldError>{form.error}</FieldError>
            </Field>
          )}
          {form.successMessage && (
            <Field>
              <FieldDescription className="text-success">
                {form.successMessage}
              </FieldDescription>
            </Field>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={form.isSubmitting}>
              {form.isSubmitting
                ? eventId
                  ? "Updating..."
                  : "Creating..."
                : eventId
                  ? "Update Event"
                  : "Create Event"}
            </Button>
            {eventId && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => form.setShowDeleteModal(true)}
                disabled={form.isSubmitting || form.isDeleting}
              >
                Delete Event
              </Button>
            )}
          </div>
        </form>
      )}

      {eventId && (
        <DeleteEventModal
          eventName={form.formState.name}
          isOpen={form.showDeleteModal}
          onClose={() => {
            form.setShowDeleteModal(false);
            form.setError(null);
          }}
          onConfirm={form.handleDeleteEvent}
          isDeleting={form.isDeleting}
          error={form.error}
        />
      )}
    </div>
  );
};
