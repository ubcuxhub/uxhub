"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAdminEventAction,
  discardUnusedEventImageAction,
  saveAdminEventAction,
} from "@/features/admin/actions";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";
import { EVENT_IMAGE_ERRORS } from "@/lib/event-image";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  EventUpdate,
  MentorRow,
  SponsorRow,
} from "@/types/models";
import type { CheckInSessionDraft } from "@/features/admin/types/checkInTypes";
import {
  createFormSnapshot,
  EMPTY_CHECK_IN_SESSION,
  getInitialFormState,
  validateEventForm,
  type EventFormState,
  type MentorDraft,
  type SponsorDraft,
} from "../components/event-form/event-form-schema";
import {
  datetimeLocalToTimestamptz,
  timestamptzToDatetimeLocal,
} from "@/lib/date";
import { useApplicationQuestions } from "./useApplicationQuestions";
import { useEventFormDraft } from "./useEventFormDraft";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

interface UseEventFormOptions {
  eventId?: string;
  initialEvent?: EventRow | null;
  initialCheckInSessions?: CheckInSessionRow[];
  initialApplicationQuestions?: EventApplicationQuestionRow[];
  initialMentors?: MentorRow[];
  initialSponsors?: SponsorRow[];
  onSuccess?: (id: string) => void;
}

function formStateFromEvent(event: EventRow): EventFormState {
  return {
    name: event.name ?? "",
    short_description: event.short_description ?? "",
    description: event.description ?? "",
    status: event.status,
    event_type: event.event_type,
    regular_price: String(event.regular_price ?? ""),
    member_price: String(event.member_price ?? ""),
    location_building: event.location_building ?? "",
    location_room: event.location_room ?? "",
    location_address_url: event.location_address_url ?? "",
    start_date: event.start_date ?? "",
    start_time: event.start_time ?? "",
    end_date: event.end_date ?? "",
    end_time: event.end_time ?? "",
    max_capacity: String(event.max_capacity ?? ""),
    image_url: event.image_url ?? "",
    registration_start_time: timestamptzToDatetimeLocal(
      event.registration_start_time
    ),
    registration_end_time: timestamptzToDatetimeLocal(
      event.registration_end_time
    ),
    created_at: event.created_at ?? "",
    mentors_enabled: event.mentors_enabled,
    sponsors_enabled: event.sponsors_enabled,
    applications_enabled: event.applications_enabled,
  };
}

function questionsFromRows(
  questions: EventApplicationQuestionRow[]
): ApplicationQuestionTemplate[] {
  return questions.map((question) => ({
    question: question.question ?? "",
    description: question.description ?? "",
    response: question.response_type,
    is_required: question.is_required,
    max_char_limit: question.max_char_limit ?? "",
    response_options: question.response_options ?? [],
    restrict_file_types: question.restrict_file_types,
    allowed_file_types: question.allowed_file_types ?? [],
    max_file_size_bytes: question.max_file_size_bytes ?? "",
  }));
}

export function useEventForm({
  eventId,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
  initialMentors = [],
  initialSponsors = [],
  onSuccess,
}: UseEventFormOptions) {
  const router = useRouter();
  const startingFormState = useMemo(
    () => (initialEvent ? formStateFromEvent(initialEvent) : getInitialFormState()),
    [initialEvent]
  );
  const startingCheckIns = useMemo(
    () =>
      initialCheckInSessions.length
        ? initialCheckInSessions.map((session) => ({
            name: session.name ?? "",
            start_time: timestamptzToDatetimeLocal(session.start_time),
            end_time: timestamptzToDatetimeLocal(session.end_time),
          }))
        : [{ ...EMPTY_CHECK_IN_SESSION }],
    [initialCheckInSessions]
  );
  const startingQuestions = useMemo(
    () => questionsFromRows(initialApplicationQuestions),
    [initialApplicationQuestions]
  );
  const [formState, setFormState] =
    useState<EventFormState>(startingFormState);
  const [checkInEvents, setCheckInEvents] =
    useState<CheckInSessionDraft[]>(startingCheckIns);
  const [mentors, setMentors] = useState<MentorDraft[]>(
    initialMentors.map((mentor) => ({
      id: mentor.id,
      full_name: mentor.full_name,
      position: mentor.position ?? "",
      linkedin_url: mentor.linkedin_url ?? "",
      description: mentor.description ?? "",
      profile_image_path: mentor.profile_image_path ?? "",
    }))
  );
  const [sponsors, setSponsors] = useState<SponsorDraft[]>(
    initialSponsors.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      brand_logo_path: sponsor.brand_logo_path ?? "",
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    eventId && !initialEvent ? "Event not found." : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  // The cover image this form believes is stored, sent as the precondition for
  // each save so a stale tab cannot revert someone else's replacement.
  const persistedImageUrl = useRef<string | null>(
    initialEvent?.image_url ?? null
  );
  const bypassUnsavedChangesWarning = useRef(false);
  const cleanSnapshot = useRef(
    createFormSnapshot(
      startingFormState,
      startingCheckIns,
      mentors,
      sponsors,
      startingQuestions
    )
  );
  const resetSuccessMessage = () => setSuccessMessage(null);
  const questions = useApplicationQuestions(
    resetSuccessMessage,
    startingQuestions
  );
  const { clearDraft } = useEventFormDraft({
    eventId,
    formState,
    checkInEvents,
    mentors,
    sponsors,
    applicationTemplate: questions.applicationTemplate,
    setFormState,
    setCheckInEvents,
    setMentors,
    setSponsors,
    setApplicationTemplate: questions.setApplicationTemplate,
  });
  const hasPendingPeopleCards =
    mentors.some((mentor) => !mentor.id || mentor.isEditing) ||
    sponsors.some((sponsor) => !sponsor.id || sponsor.isEditing);
  const hasUnsavedChanges =
    hasPendingPeopleCards ||
    createFormSnapshot(
      formState,
      checkInEvents,
      mentors,
      sponsors,
      questions.applicationTemplate,
      pendingImageFile
    ) !== cleanSnapshot.current;
  useUnsavedChangesGuard(hasUnsavedChanges, bypassUnsavedChangesWarning);

  const handleFieldChange = <K extends keyof EventFormState>(
    field: K,
    value: EventFormState[K]
  ) => {
    resetSuccessMessage();
    questions.setQuestionErrors({});
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const updateCheckInEvent = (
    index: number,
    field: keyof CheckInSessionDraft,
    value: string
  ) => {
    resetSuccessMessage();
    setCheckInEvents((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addCheckInEvent = () => {
    resetSuccessMessage();
    setCheckInEvents((current) => [
      ...current,
      { ...EMPTY_CHECK_IN_SESSION },
    ]);
  };

  const removeCheckInEvent = (index: number) => {
    resetSuccessMessage();
    setCheckInEvents((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const uploadImage = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    body.append("eventName", formState.name);
    const response = await fetch("/api/upload-event-image", {
      method: "POST",
      body,
    });

    // Not every failure is JSON: the platform rejects oversized bodies before
    // the handler runs, and a non-admin gets an HTML redirect.
    const data = await response
      .json()
      .catch(() => null as { error?: string; url?: string } | null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          (response.status === 413
            ? EVENT_IMAGE_ERRORS.size
            : "Failed to upload image.")
      );
    }

    if (!data?.url) throw new Error("Failed to upload image.");
    return data.url;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetSuccessMessage();
    setError(null);
    const hasUnsavedMentors = mentors.some(
      (mentor) => !mentor.id || mentor.isEditing
    );
    const hasUnsavedSponsors = sponsors.some(
      (sponsor) => !sponsor.id || sponsor.isEditing
    );
    if (hasUnsavedMentors || hasUnsavedSponsors) {
      setFormState((current) => ({
        ...current,
        mentors_enabled: current.mentors_enabled || hasUnsavedMentors,
        sponsors_enabled: current.sponsors_enabled || hasUnsavedSponsors,
      }));
      setError(
        "Save or cancel every mentor and sponsor card before saving the event."
      );
      return;
    }
    const validation = validateEventForm(
      formState,
      checkInEvents,
      questions.applicationTemplate,
      mentors,
      sponsors
    );
    questions.setQuestionErrors(validation.questionErrors);
    if (validation.error) {
      setFormState((current) => ({
        ...current,
        mentors_enabled:
          current.mentors_enabled || validation.invalidSections.mentors,
        sponsors_enabled:
          current.sponsors_enabled || validation.invalidSections.sponsors,
        applications_enabled:
          current.applications_enabled ||
          validation.invalidSections.applications,
      }));
      setError(validation.error);
      return;
    }
    setIsSubmitting(true);

    let imageUrl = formState.image_url;
    // Tracked separately so a failure after the upload can take the orphaned
    // object back out instead of leaking one per attempt.
    let uploadedImageUrl: string | null = null;
    try {
      if (pendingImageFile) {
        imageUrl = await uploadImage(pendingImageFile);
        uploadedImageUrl = imageUrl;
      }
      const payload: EventUpdate = {
        name: formState.name,
        short_description: formState.short_description || null,
        description: formState.description,
        status: formState.status,
        event_type: formState.event_type,
        mentors_enabled: formState.mentors_enabled,
        sponsors_enabled: formState.sponsors_enabled,
        applications_enabled: formState.applications_enabled,
        regular_price: Number(formState.regular_price),
        member_price: Number(formState.member_price),
        max_capacity: Number(formState.max_capacity),
        created_at: formState.created_at || new Date().toISOString(),
        location_building: formState.location_building || undefined,
        location_room: formState.location_room || undefined,
        location_address_url: formState.location_address_url || undefined,
        start_date: formState.start_date || undefined,
        start_time: formState.start_time || undefined,
        end_date: formState.end_date || undefined,
        end_time: formState.end_time || undefined,
        image_url: imageUrl || null,
        registration_start_time: datetimeLocalToTimestamptz(
          formState.registration_start_time
        ),
        registration_end_time: datetimeLocalToTimestamptz(
          formState.registration_end_time
        ),
      };
      const checkInSessions = checkInEvents.map((session) => ({
        name: session.name,
        start_time: datetimeLocalToTimestamptz(session.start_time)!,
        end_time: datetimeLocalToTimestamptz(session.end_time)!,
      }));
      const applicationQuestions = questions.applicationTemplate.map(
        (question, sortOrder) => ({
          question: question.question,
          description: question.description || null,
          response_type: question.response,
          is_required: question.is_required,
          sort_order: sortOrder,
          max_char_limit:
            question.response === ResponseType.short_text ||
            question.response === ResponseType.long_text
              ? question.max_char_limit === ""
                ? 5000
                : question.max_char_limit
              : null,
          response_options:
            question.response === ResponseType.checkbox ||
            question.response === ResponseType.multiple_choice ||
            question.response === ResponseType.dropdown
              ? question.response_options || []
              : null,
          restrict_file_types:
            question.response === ResponseType.file_upload
              ? question.restrict_file_types
              : false,
          allowed_file_types:
            question.response === ResponseType.file_upload &&
            question.restrict_file_types
              ? question.allowed_file_types
              : null,
          max_file_size_bytes:
            question.response === ResponseType.file_upload &&
            question.max_file_size_bytes !== ""
              ? question.max_file_size_bytes
              : null,
        })
      );
      const result = await saveAdminEventAction({
        eventId,
        expectedImageUrl: persistedImageUrl.current,
        event: payload,
        checkInSessions,
        mentorIds: mentors.map((mentor) => mentor.id!),
        sponsorIds: sponsors.map((sponsor) => sponsor.id!),
        applicationQuestions,
      });
      const savedFormState = { ...formState, image_url: imageUrl };
      persistedImageUrl.current = imageUrl || null;
      setFormState(savedFormState);
      setPendingImageFile(null);
      cleanSnapshot.current = createFormSnapshot(
        savedFormState,
        checkInEvents,
        mentors,
        sponsors,
        questions.applicationTemplate
      );
      setSuccessMessage(
        eventId ? "Event updated successfully." : "Event created successfully."
      );

      if (!eventId) {
        clearDraft();
        const resetFormState = getInitialFormState();
        const resetCheckIns = [{ ...EMPTY_CHECK_IN_SESSION }];
        persistedImageUrl.current = null;
        setFormState(resetFormState);
        setCheckInEvents(resetCheckIns);
        setMentors([]);
        setSponsors([]);
        questions.setApplicationTemplate([]);
        cleanSnapshot.current = createFormSnapshot(
          resetFormState,
          resetCheckIns,
          [],
          [],
          []
        );
      }
      if (onSuccess) {
        bypassUnsavedChangesWarning.current = true;
        onSuccess(result.id);
      } else if (!eventId) {
        bypassUnsavedChangesWarning.current = true;
        router.push("/admin/events");
      } else {
        router.refresh();
      }
    } catch (saveError) {
      // The upload landed but nothing references it, so clean it up. Best
      // effort: the save error is what the admin needs to see.
      if (uploadedImageUrl) {
        try {
          await discardUnusedEventImageAction(uploadedImageUrl);
        } catch {
          // Leaves an orphaned object; not worth masking the save error.
        }
      }
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save event."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAdminEventAction(eventId);
      setShowDeleteModal(false);
      bypassUnsavedChangesWarning.current = true;
      router.push("/admin/events");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete event."
      );
      setIsDeleting(false);
    }
  };

  return {
    formState,
    checkInEvents,
    mentors,
    setMentors,
    sponsors,
    setSponsors,
    isSubmitting,
    loadingEvent: false,
    error,
    setError,
    successMessage,
    showDeleteModal,
    setShowDeleteModal,
    isDeleting,
    setPendingImageFile,
    handleFieldChange,
    updateCheckInEvent,
    addCheckInEvent,
    removeCheckInEvent,
    handleSubmit,
    handleDeleteEvent,
    ...questions,
  };
}
