"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAdminEventAction,
  saveAdminEventAction,
} from "@/features/admin/actions";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  EventUpdate,
} from "@/types/models";
import type { CheckInSessionDraft } from "@/features/admin/types/checkInTypes";
import {
  createFormSnapshot,
  EMPTY_CHECK_IN_SESSION,
  getInitialFormState,
  validateEventForm,
  type EventFormState,
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
  onSuccess?: (id: string) => void;
}

function formStateFromEvent(event: EventRow): EventFormState {
  return {
    name: event.name ?? "",
    description: event.description ?? "",
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
  };
}

function questionsFromRows(
  questions: EventApplicationQuestionRow[]
): ApplicationQuestionTemplate[] {
  return questions.map((question) => ({
    question: question.question ?? "",
    response: question.response_type,
    max_char_limit: question.max_char_limit ?? "",
    response_options: question.response_options ?? [],
  }));
}

export function useEventForm({
  eventId,
  initialEvent = null,
  initialCheckInSessions = [],
  initialApplicationQuestions = [],
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    eventId && !initialEvent ? "Event not found." : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const bypassUnsavedChangesWarning = useRef(false);
  const cleanSnapshot = useRef(
    createFormSnapshot(startingFormState, startingCheckIns, startingQuestions)
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
    applicationTemplate: questions.applicationTemplate,
    setFormState,
    setCheckInEvents,
    setApplicationTemplate: questions.setApplicationTemplate,
  });
  const hasUnsavedChanges =
    createFormSnapshot(
      formState,
      checkInEvents,
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
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to upload image");
    return data.path as string;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetSuccessMessage();
    setError(null);
    const validation = validateEventForm(
      formState,
      checkInEvents,
      questions.applicationTemplate
    );
    questions.setQuestionErrors(validation.questionErrors);
    if (validation.error) {
      setError(validation.error);
      return;
    }
    setIsSubmitting(true);

    let imageUrl = formState.image_url;
    try {
      if (pendingImageFile) imageUrl = await uploadImage(pendingImageFile);
      const payload: EventUpdate = {
        name: formState.name,
        description: formState.description,
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
        (question) => ({
          question: question.question,
          response_type: question.response,
          max_char_limit:
            question.response === ResponseType.text
              ? question.max_char_limit === ""
                ? 5000
                : question.max_char_limit
              : null,
          response_options:
            question.response === ResponseType.multi_select ||
            question.response === ResponseType.single_select
              ? question.response_options || []
              : null,
        })
      );
      const result = await saveAdminEventAction({
        eventId,
        event: payload,
        checkInSessions,
        applicationQuestions,
      });
      const savedFormState = { ...formState, image_url: imageUrl };
      setFormState(savedFormState);
      setPendingImageFile(null);
      cleanSnapshot.current = createFormSnapshot(
        savedFormState,
        checkInEvents,
        questions.applicationTemplate
      );
      setSuccessMessage(
        eventId ? "Event updated successfully." : "Event created successfully."
      );

      if (!eventId) {
        clearDraft();
        const resetFormState = getInitialFormState();
        const resetCheckIns = [{ ...EMPTY_CHECK_IN_SESSION }];
        setFormState(resetFormState);
        setCheckInEvents(resetCheckIns);
        questions.setApplicationTemplate([]);
        cleanSnapshot.current = createFormSnapshot(resetFormState, resetCheckIns, []);
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
