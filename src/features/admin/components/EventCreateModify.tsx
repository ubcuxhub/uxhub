"use client";

import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  MentorRow,
  SponsorRow,
} from "@/types/models";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { useEventForm } from "@/features/admin/hooks/useEventForm";
import { PrimaryDetailsSection } from "./event-form/PrimaryDetailsSection";
import { CheckInEventsSection } from "./event-form/CheckInEventsSection";
import { MentorsSection } from "./event-form/MentorsSection";
import { SponsorsSection } from "./event-form/SponsorsSection";
import { ApplicationQuestionsSection } from "./event-form/ApplicationQuestionsSection";
import { EventFormSkeleton } from "./event-form/EventFormSkeleton";
import { DeleteEventModal } from "./DeleteEventModal";

interface EventCreateModifyProps {
  eventId?: string;
  initialEvent?: EventRow | null;
  initialCheckInSessions?: CheckInSessionRow[];
  initialApplicationQuestions?: EventApplicationQuestionRow[];
  initialMentors?: MentorRow[];
  initialSponsors?: SponsorRow[];
  mentorOptions?: MentorRow[];
  sponsorOptions?: SponsorRow[];
  onSuccess?: (id: string) => void;
  title?: string;
  description?: string;
}

export const EventCreateModify = ({
  eventId,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  initialMentors = [],
  initialSponsors = [],
  mentorOptions = [],
  sponsorOptions = [],
  onSuccess,
  title,
  description,
}: EventCreateModifyProps) => {
  const form = useEventForm({
    eventId,
    initialEvent,
    initialCheckInSessions,
    initialApplicationQuestions,
    initialMentors,
    initialSponsors,
    onSuccess,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <div>
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
      </div>

      {form.loadingEvent ? (
        <EventFormSkeleton />
      ) : (
        <form className="flex flex-col gap-6" onSubmit={form.handleSubmit}>
          <PrimaryDetailsSection
            formState={form.formState}
            isSubmitting={form.isSubmitting}
            onImageFileChange={form.setPendingImageFile}
            onFieldChange={form.handleFieldChange}
          />
          <CheckInEventsSection
            checkInEvents={form.checkInEvents}
            onAdd={form.addCheckInEvent}
            onRemove={form.removeCheckInEvent}
            onUpdate={form.updateCheckInEvent}
          />
          <MentorsSection
            enabled={form.formState.mentors_enabled}
            mentors={form.mentors}
            options={mentorOptions}
            onEnabledChange={(enabled) =>
              form.handleFieldChange("mentors_enabled", enabled)
            }
            onChange={form.setMentors}
          />
          <SponsorsSection
            enabled={form.formState.sponsors_enabled}
            sponsors={form.sponsors}
            options={sponsorOptions}
            onEnabledChange={(enabled) =>
              form.handleFieldChange("sponsors_enabled", enabled)
            }
            onChange={form.setSponsors}
          />
          <ApplicationQuestionsSection
            enabled={form.formState.applications_enabled}
            applicationTemplate={form.applicationTemplate}
            questionErrors={form.questionErrors}
            onEnabledChange={(enabled) =>
              form.handleFieldChange("applications_enabled", enabled)
            }
            onAdd={form.addApplicationQuestion}
            onRemove={form.removeApplicationQuestion}
            onUpdate={form.updateApplicationQuestion}
            onAddResponseOption={form.addResponseOption}
            onUpdateResponseOption={form.updateResponseOption}
            onRemoveResponseOption={form.removeResponseOption}
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
