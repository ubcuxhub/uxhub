"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import {
  deleteEvent,
  fetchEventById,
  fetchEventSlugsByPrefix,
  insertEvent,
  updateEvent,
} from "@/lib/supabase-helpers/events";
import {
  deleteCheckInSessionsForEvent,
  fetchCheckInSessions,
  insertCheckInSessions,
} from "@/lib/supabase-helpers/check-ins";
import {
  deleteApplicationQuestionsForEvent,
  fetchApplicationQuestions,
  insertApplicationQuestions,
} from "@/lib/supabase-helpers/event-applications";
import { deleteRegistrationsForEvent } from "@/lib/supabase-helpers/event-registrations";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";
import type {
  CheckInSessionInsert,
  EventApplicationQuestionInsert,
  EventInsert,
  EventUpdate,
} from "@/types/models";
import type { CheckInSessionDraft } from "../types/checkInTypes";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { BasicEventInfo } from "./event-form/BasicEventInfo";
import { EventPricing } from "./event-form/EventPricing";
import { EventLocation } from "./event-form/EventLocation";
import { EventSchedule } from "./event-form/EventSchedule";
import { RegistrationTimes } from "./event-form/RegistrationTimes";
import { CheckInEventsSection } from "./event-form/CheckInEventsSection";
import { ApplicationQuestionsSection } from "./event-form/ApplicationQuestionsSection";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/shared/BackButton";
import { DeleteEventModal } from "./DeleteEventModal";
import { createUniqueSlug, slugify } from "@/lib/slug";

interface EventCreateModifyProps {
  eventId?: string;
  onSuccess?: (id: string) => void;
  title?: string;
  description?: string;
}

interface EventFormState {
  name: string;
  description: string;
  regular_price: string;
  member_price: string;
  location_building: string;
  location_room: string;
  location_address_url: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  max_capacity: string;
  image_url: string;
  registration_start_time: string;
  registration_end_time: string;
  created_at: string;
}

interface EventFormSnapshot {
  formState: EventFormState;
  checkInEvents: CheckInSessionDraft[];
  applicationTemplate: ApplicationQuestionTemplate[];
  pendingImageFile: {
    name: string;
    size: number;
    lastModified: number;
  } | null;
}

const defaultFormState: EventFormState = {
  name: "",
  description: "",
  regular_price: "",
  member_price: "",
  location_building: "",
  location_room: "",
  location_address_url: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  max_capacity: "",
  image_url: "",
  registration_start_time: "",
  registration_end_time: "",
  created_at: "",
};

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const getPacificStartDefaults = (): Pick<
  EventFormState,
  "start_date" | "start_time"
> => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const valueFor = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    start_date: `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`,
    start_time: `${valueFor("hour")}:${valueFor("minute")}`,
  };
};

const withPacificStartDefaults = (formState: EventFormState): EventFormState => {
  const defaults = getPacificStartDefaults();

  return {
    ...formState,
    start_date: formState.start_date || defaults.start_date,
    start_time: formState.start_time || defaults.start_time,
  };
};

const getInitialFormState = (): EventFormState =>
  withPacificStartDefaults(defaultFormState);

// Helper function to convert timestamptz to datetime-local format
// Converts UTC timestamptz to local datetime-local string
const timestamptzToDatetimeLocal = (timestamptz: string | null): string => {
  if (!timestamptz) return "";
  const date = new Date(timestamptz);
  // Get local date components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper function to convert datetime-local to timestamptz format
// Converts local datetime-local string to UTC timestamptz
const datetimeLocalToTimestamptz = (datetimeLocal: string): string | null => {
  if (!datetimeLocal) return null;
  // Create date from local datetime string (browser interprets as local time)
  const date = new Date(datetimeLocal);
  // Return as ISO string (UTC)
  return date.toISOString();
};

const isDateTimeRangeInvalid = (start: string, end: string) => {
  if (!start || !end) return false;

  return new Date(start) >= new Date(end);
};

const isEventScheduleRangeInvalid = (formState: EventFormState) => {
  const { start_date, start_time, end_date, end_time } = formState;

  if (!start_date || !start_time || !end_date || !end_time) return false;

  return isDateTimeRangeInvalid(
    `${start_date}T${start_time}`,
    `${end_date}T${end_time}`
  );
};

const createFormSnapshot = (
  formState: EventFormState,
  checkInEvents: CheckInSessionDraft[],
  applicationTemplate: ApplicationQuestionTemplate[],
  pendingImageFile: File | null = null
) =>
  JSON.stringify({
    formState,
    checkInEvents,
    applicationTemplate,
    pendingImageFile: pendingImageFile
      ? {
          name: pendingImageFile.name,
          size: pendingImageFile.size,
          lastModified: pendingImageFile.lastModified,
        }
      : null,
  } satisfies EventFormSnapshot);

const UNSAVED_CHANGES_MESSAGE =
  "Changes may not be saved. Are you sure you want to leave?";

// Add a storage key constant after the defaultFormState
const STORAGE_KEY = "event_create_form_draft";

export const EventCreateModify = ({
  eventId,
  onSuccess,
  title,
  description,
}: EventCreateModifyProps) => {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const isInitialMount = useRef(true);
  const hasRestoredState = useRef(false);
  const initialFormState = useMemo(() => getInitialFormState(), []);
  const cleanSnapshot = useRef(
    createFormSnapshot(
      initialFormState,
      [{ name: "", start_time: "", end_time: "" }],
      []
    )
  );
  const bypassUnsavedChangesWarning = useRef(false);

  const [formState, setFormState] =
    useState<EventFormState>(initialFormState);
  const [checkInEvents, setCheckInEvents] = useState<CheckInSessionDraft[]>([
    { name: "", start_time: "", end_time: "" },
  ]);
  const [applicationTemplate, setApplicationTemplate] = useState<
    ApplicationQuestionTemplate[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(!!eventId);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  // Restore state from sessionStorage on mount (only for new events)
  useEffect(() => {
    if (eventId) {
      // If editing an existing event, clear any draft
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      hasRestoredState.current = true;
      return;
    }

    // Only restore on initial mount
    if (
      isInitialMount.current &&
      !hasRestoredState.current &&
      typeof window !== "undefined"
    ) {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Defer state updates to avoid cascading renders
          setTimeout(() => {
            setFormState(
              parsed.formState
                ? withPacificStartDefaults({
                    ...defaultFormState,
                    ...parsed.formState,
                  })
                : getInitialFormState()
            );
            setCheckInEvents(
              parsed.checkInEvents || [
                { name: "", start_time: "", end_time: "" },
              ]
            );
            setApplicationTemplate(
              parsed.applicationTemplate || []
            );
          }, 0);
        }
      } catch (error) {
        console.error("Error restoring form state:", error);
        // Clear corrupted data
        sessionStorage.removeItem(STORAGE_KEY);
      }
      hasRestoredState.current = true;
    }
    isInitialMount.current = false;
  }, [eventId]);

  // Persist state to sessionStorage (only for new events)
  useEffect(() => {
    if (eventId || !hasRestoredState.current) return; // Don't save if editing or before initial restore

    try {
      const stateToSave = {
        formState,
        checkInEvents,
        applicationTemplate,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving form state:", error);
    }
  }, [formState, checkInEvents, applicationTemplate, eventId]);

  useEffect(() => {
    if (loadingEvent) return;

    const currentSnapshot = createFormSnapshot(
      formState,
      checkInEvents,
      applicationTemplate,
      pendingImageFile
    );
    setHasUnsavedChanges(currentSnapshot !== cleanSnapshot.current);
  }, [
    formState,
    checkInEvents,
    applicationTemplate,
    pendingImageFile,
    loadingEvent,
  ]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassUnsavedChangesWarning.current) return;

      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (bypassUnsavedChangesWarning.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();

      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) return;

      bypassUnsavedChangesWarning.current = true;

      if (anchor.origin === window.location.origin) {
        router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`);
      } else {
        window.location.assign(anchor.href);
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleDocumentClick, {
        capture: true,
      });
    };
  }, [hasUnsavedChanges, router]);

  useEffect(() => {
    const fetchExistingEvent = async () => {
      if (!eventId) return;

      setLoadingEvent(true);
      setError(null);

      let data;
      try {
        data = await fetchEventById(supabase, eventId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event.");
        setLoadingEvent(false);
        return;
      }

      if (!data) {
        setError("Event not found.");
        setLoadingEvent(false);
        return;
      }

      const loadedFormState: EventFormState = {
        name: data.name ?? "",
        description: data.description ?? "",
        regular_price:
          data.regular_price !== null && data.regular_price !== undefined
            ? String(data.regular_price)
            : "",
        member_price:
          data.member_price !== null && data.member_price !== undefined
            ? String(data.member_price)
            : "",
        location_building: data.location_building ?? "",
        location_room: data.location_room ?? "",
        location_address_url: data.location_address_url ?? "",
        start_date: data.start_date ?? "",
        start_time: data.start_time ?? "",
        end_date: data.end_date ?? "",
        end_time: data.end_time ?? "",
        max_capacity:
          data.max_capacity !== null && data.max_capacity !== undefined
            ? String(data.max_capacity)
            : "",
        image_url: data.image_url ?? "",
        registration_start_time: timestamptzToDatetimeLocal(
          data.registration_start_time
        ),
        registration_end_time: timestamptzToDatetimeLocal(
          data.registration_end_time
        ),
        created_at: data.created_at ?? "",
      };
      setFormState(loadedFormState);
      setPendingImageFile(null);

      // Fetch check-in sessions from check_in_sessions table
      let loadedCheckInEvents: CheckInSessionDraft[] = [
        { name: "", start_time: "", end_time: "" },
      ];
      try {
        const checkInSessionsData = await fetchCheckInSessions(
          supabase,
          eventId
        );
        if (checkInSessionsData.length > 0) {
          loadedCheckInEvents = checkInSessionsData.map((session) => ({
            name: session.name ?? "",
            start_time: timestamptzToDatetimeLocal(session.start_time),
            end_time: timestamptzToDatetimeLocal(session.end_time),
          }));
        }
        setCheckInEvents(loadedCheckInEvents);
      } catch (checkInSessionsError) {
        console.error(
          "Error fetching check-in sessions:",
          checkInSessionsError
        );
        setCheckInEvents([{ name: "", start_time: "", end_time: "" }]);
      }

      // Fetch application questions from event_application_questions table
      let loadedApplicationTemplate: ApplicationQuestionTemplate[] = [];
      try {
        const questionsData = await fetchApplicationQuestions(
          supabase,
          eventId
        );
        if (questionsData.length > 0) {
          loadedApplicationTemplate = questionsData.map((q) => ({
            question: q.question ?? "",
            response: (q.response_type as ResponseType) ?? ResponseType.text,
            max_char_limit: q.max_char_limit ?? "",
            response_options: q.response_options ?? [],
          }));
        }
        setApplicationTemplate(loadedApplicationTemplate);
      } catch (questionsError) {
        console.error("Error fetching application questions:", questionsError);
        setApplicationTemplate([]);
      }

      cleanSnapshot.current = createFormSnapshot(
        loadedFormState,
        loadedCheckInEvents,
        loadedApplicationTemplate
      );
      setHasUnsavedChanges(false);
      setLoadingEvent(false);
    };

    fetchExistingEvent();
  }, [eventId, supabase]);

  const resetSuccessMessage = () => {
    if (successMessage) {
      setSuccessMessage(null);
    }
  };

  const clearQuestionErrors = () => {
    setQuestionErrors({});
  };

  const handleFieldChange = <K extends keyof EventFormState>(
    field: K,
    value: EventFormState[K]
  ) => {
    resetSuccessMessage();
    clearQuestionErrors();
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageFileChange = (file: File | null) => {
    resetSuccessMessage();
    setPendingImageFile(file);
  };

  const updateCheckInEvent = (
    index: number,
    field: keyof CheckInSessionDraft,
    value: string
  ) => {
    resetSuccessMessage();
    setCheckInEvents((prev) =>
      prev.map((event, idx) =>
        idx === index
          ? {
              ...event,
              [field]: value,
            }
          : event
      )
    );
  };

  const addCheckInEvent = () => {
    resetSuccessMessage();
    setCheckInEvents((prev) => [
      ...prev,
      { name: "", start_time: "", end_time: "" },
    ]);
  };

  const removeCheckInEvent = (index: number) => {
    resetSuccessMessage();
    setCheckInEvents((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)
    );
  };

  const updateApplicationQuestion = (
    index: number,
    field: keyof ApplicationQuestionTemplate,
    value: string | ResponseType | number | string[]
  ) => {
    resetSuccessMessage();
    // Clear error for this question when user modifies fields that affect validation
    if (
      field === "question" ||
      field === "max_char_limit" ||
      field === "response_options"
    ) {
      setQuestionErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
    setApplicationTemplate((prev) =>
      prev.map((question, idx) =>
        idx === index
          ? {
              ...question,
              [field]:
                field === "max_char_limit"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : field === "response_options"
                  ? (value as string[])
                  : (value as string | ResponseType),
            }
          : question
      )
    );
  };

  const addResponseOption = (index: number) => {
    resetSuccessMessage();
    setApplicationTemplate((prev) =>
      prev.map((question, idx) =>
        idx === index
          ? {
              ...question,
              response_options: [...(question.response_options || []), ""],
            }
          : question
      )
    );
  };

  const updateResponseOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    resetSuccessMessage();
    setApplicationTemplate((prev) =>
      prev.map((question, idx) =>
        idx === questionIndex
          ? {
              ...question,
              response_options: (question.response_options || []).map(
                (opt, optIdx) => (optIdx === optionIndex ? value : opt)
              ),
            }
          : question
      )
    );
  };

  const removeResponseOption = (questionIndex: number, optionIndex: number) => {
    resetSuccessMessage();
    setApplicationTemplate((prev) =>
      prev.map((question, idx) =>
        idx === questionIndex
          ? {
              ...question,
              response_options: (question.response_options || []).filter(
                (_, optIdx) => optIdx !== optionIndex
              ),
            }
          : question
      )
    );
  };

  const addApplicationQuestion = () => {
    resetSuccessMessage();
    setApplicationTemplate((prev) => [
      ...prev,
      {
        question: "",
        response: ResponseType.text,
        max_char_limit: "",
        response_options: [],
      },
    ]);
  };

  const removeApplicationQuestion = (index: number) => {
    resetSuccessMessage();
    setApplicationTemplate((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResponseTypeChange = (
    index: number,
    newResponseType: ResponseType
  ) => {
    resetSuccessMessage();
    // Clear error for this question when response type changes
    setQuestionErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
    // Update response type and initialize appropriate fields
    setApplicationTemplate((prev) =>
      prev.map((q, idx) =>
        idx === index
          ? {
              ...q,
              response: newResponseType,
              ...(newResponseType === ResponseType.multi_select ||
              newResponseType === ResponseType.single_select
                ? {
                    response_options: q.response_options || [],
                  }
                : {}),
              ...(newResponseType === ResponseType.text && !q.max_char_limit
                ? { max_char_limit: "" }
                : {}),
            }
          : q
      )
    );
  };

  const uploadPendingEventImage = async (file: File, eventName: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("eventName", eventName);

    const response = await fetch("/api/upload-event-image", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload image");
    }

    return data.path as string;
  };

  const validateForm = () => {
    if (!formState.name.trim()) return "Event name is required.";
    if (!formState.description.trim()) return "Description is required.";
    if (!formState.regular_price.trim()) return "Regular price is required.";
    if (Number.isNaN(Number(formState.regular_price)))
      return "Regular price must be a valid number.";
    if (!formState.member_price.trim()) return "Member price is required.";
    if (Number.isNaN(Number(formState.member_price)))
      return "Member price must be a valid number.";
    if (!formState.max_capacity) return "Max capacity is required.";
    if (isEventScheduleRangeInvalid(formState))
      return "Event end time must be after the start time.";
    if (
      isDateTimeRangeInvalid(
        formState.registration_start_time,
        formState.registration_end_time
      )
    )
      return "Registration end time must be after the start time.";
    if (
      !checkInEvents.every(
        (item) => item.name && item.start_time && item.end_time
      )
    )
      return "All check-in sessions require name, start time, and end time.";
    if (
      checkInEvents.some((item) =>
        isDateTimeRangeInvalid(item.start_time, item.end_time)
      )
    )
      return "Check-in end time must be after the start time.";

    // Validate application questions and track errors per question
    const newQuestionErrors: Record<number, string> = {};
    if (applicationTemplate.length > 0) {
      for (let i = 0; i < applicationTemplate.length; i++) {
        const item = applicationTemplate[i];
        if (!item.question.trim()) {
          newQuestionErrors[i] = "Question is required.";
        } else {
          if (item.response === ResponseType.text) {
            if (
              item.max_char_limit !== "" &&
              item.max_char_limit <= 0
            ) {
              newQuestionErrors[i] =
                "Text response questions require a maximum character limit greater than 0.";
            }
          } else if (
            item.response === ResponseType.multi_select ||
            item.response === ResponseType.single_select
          ) {
            if (
              !item.response_options ||
              item.response_options.length === 0 ||
              !item.response_options.every((opt) => opt.trim())
            ) {
              newQuestionErrors[i] =
                "Select response questions require at least one option.";
            }
          }
        }
      }
    }

    setQuestionErrors(newQuestionErrors);

    // If there are question errors, return a generic error
    if (Object.keys(newQuestionErrors).length > 0) {
      return "Please fix the errors in application questions.";
    }

    if (!formState.regular_price.trim()) return "Regular price is required.";
    if (Number.isNaN(Number(formState.regular_price)))
      return "Regular price must be a valid number.";
    if (!formState.member_price.trim()) return "Member price is required.";
    if (Number.isNaN(Number(formState.member_price)))
      return "Member price must be a valid number.";

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetSuccessMessage();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    let eventSlug: string | undefined;

    if (!eventId) {
      const normalizedBaseSlug = slugify(formState.name);
      const baseSlug =
        normalizedBaseSlug === "item" ? "event" : normalizedBaseSlug;

      let existingSlugs: string[];
      try {
        existingSlugs = await fetchEventSlugsByPrefix(supabase, baseSlug);
      } catch (slugFetchError) {
        const message =
          slugFetchError instanceof Error
            ? slugFetchError.message
            : "Unknown error";
        setError(`Failed to prepare event slug: ${message}`);
        setIsSubmitting(false);
        return;
      }

      eventSlug = createUniqueSlug(formState.name, existingSlugs, "event");
    }

    let committedImageUrl = formState.image_url;
    if (pendingImageFile) {
      try {
        committedImageUrl = await uploadPendingEventImage(
          pendingImageFile,
          formState.name
        );
      } catch (imageUploadError) {
        setError(
          imageUploadError instanceof Error
            ? imageUploadError.message
            : "Failed to upload image"
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Prepare payload
    const payload: {
      name: string;
      slug?: string;
      description: string;
      regular_price: number;
      member_price: number;
      max_capacity: number;
      created_at: string;
      location_building?: string;
      location_room?: string;
      location_address_url?: string;
      start_date?: string;
      start_time?: string;
      end_date?: string;
      end_time?: string;
      image_url?: string | null;
      registration_start_time?: string | null;
      registration_end_time?: string | null;
    } = {
      name: formState.name,
      description: formState.description,
      regular_price: Number(formState.regular_price),
      member_price: Number(formState.member_price),
      max_capacity: Number(formState.max_capacity),
      created_at: formState.created_at || new Date().toISOString(),
    };

    if (eventSlug) {
      payload.slug = eventSlug;
    }

    // Add optional fields only if they have values
    if (formState.location_building) {
      payload.location_building = formState.location_building;
    }
    if (formState.location_room) {
      payload.location_room = formState.location_room;
    }
    if (formState.location_address_url) {
      payload.location_address_url = formState.location_address_url;
    }
    if (formState.start_date) {
      payload.start_date = formState.start_date;
    }
    if (formState.start_time) {
      payload.start_time = formState.start_time;
    }
    if (formState.end_date) {
      payload.end_date = formState.end_date;
    }
    if (formState.end_time) {
      payload.end_time = formState.end_time;
    }
    if (committedImageUrl) {
      payload.image_url = committedImageUrl;
    } else {
      payload.image_url = null;
    }
    if (formState.registration_start_time) {
      payload.registration_start_time = datetimeLocalToTimestamptz(
        formState.registration_start_time
      );
    }
    if (formState.registration_end_time) {
      payload.registration_end_time = datetimeLocalToTimestamptz(
        formState.registration_end_time
      );
    }

    // First, insert or update the event
    let finalEventId: string;
    try {
      const result = eventId
        ? await updateEvent(supabase, eventId, payload as EventUpdate)
        : await insertEvent(supabase, {
            ...payload,
            slug: eventSlug ?? "event",
          } as EventInsert);
      finalEventId = result.id;
    } catch (upsertError) {
      setError(
        upsertError instanceof Error
          ? upsertError.message
          : "No event id returned from Supabase."
      );
      setIsSubmitting(false);
      return;
    }

    // If updating, delete existing check-in sessions and application questions
    if (eventId) {
      try {
        await deleteCheckInSessionsForEvent(supabase, eventId);
      } catch (deleteCheckInError) {
        const message =
          deleteCheckInError instanceof Error
            ? deleteCheckInError.message
            : "Unknown error";
        setError(`Failed to delete existing check-in sessions: ${message}`);
        setIsSubmitting(false);
        return;
      }

      try {
        await deleteApplicationQuestionsForEvent(supabase, eventId);
      } catch (deleteError) {
        const message =
          deleteError instanceof Error ? deleteError.message : "Unknown error";
        setError(`Failed to delete existing questions: ${message}`);
        setIsSubmitting(false);
        return;
      }
    }

    // Insert check-in sessions if there are any
    if (checkInEvents.length > 0) {
      // Filter out empty sessions (where name, start_time, or end_time is empty)
      const validSessions = checkInEvents.filter(
        (session) =>
          session.name.trim() &&
          session.start_time.trim() &&
          session.end_time.trim()
      );

      if (validSessions.length > 0) {
        const sessionsToInsert = validSessions
          .map((session) => {
            const startTime = datetimeLocalToTimestamptz(session.start_time);
            const endTime = datetimeLocalToTimestamptz(session.end_time);
            // Only include if both times are valid
            if (startTime && endTime) {
              return {
                event_id: finalEventId,
                name: session.name,
                start_time: startTime,
                end_time: endTime,
              };
            }
            return null;
          })
          .filter(
            (session): session is NonNullable<typeof session> =>
              session !== null
          );

        try {
          await insertCheckInSessions(
            supabase,
            sessionsToInsert as CheckInSessionInsert[]
          );
        } catch (checkInSessionsError) {
          const message =
            checkInSessionsError instanceof Error
              ? checkInSessionsError.message
              : "Unknown error";
          setError(`Failed to save check-in sessions: ${message}`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    // Insert application questions if there are any
    if (applicationTemplate.length > 0) {
      // Filter out empty questions (where question is empty)
      const validQuestions = applicationTemplate.filter((q) =>
        q.question.trim()
      );

      if (validQuestions.length > 0) {
        const questionsToInsert = validQuestions.map((q) => {
          const questionData: EventApplicationQuestionInsert = {
            event_id: finalEventId,
            question: q.question,
            response_type: q.response,
          };

          if (q.response === ResponseType.text) {
            questionData.max_char_limit =
              q.max_char_limit === "" ? 5000 : q.max_char_limit;
          } else if (
            q.response === ResponseType.multi_select ||
            q.response === ResponseType.single_select
          ) {
            questionData.response_options = q.response_options || [];
          }

          return questionData;
        });

        try {
          await insertApplicationQuestions(supabase, questionsToInsert);
        } catch (questionsError) {
          const message =
            questionsError instanceof Error
              ? questionsError.message
              : "Unknown error";
          setError(`Failed to save application questions: ${message}`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    const savedFormState = {
      ...formState,
      image_url: committedImageUrl,
    };
    setFormState(savedFormState);
    setPendingImageFile(null);
    cleanSnapshot.current = createFormSnapshot(
      savedFormState,
      checkInEvents,
      applicationTemplate,
      null
    );
    setHasUnsavedChanges(false);
    setSuccessMessage(
      eventId ? "Event updated successfully." : "Event created successfully."
    );
    setIsSubmitting(false);
    if (!eventId) {
      // Clear persisted state after successful creation
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      const resetFormState = getInitialFormState();
      const resetCheckInEvents = [{ name: "", start_time: "", end_time: "" }];
      setFormState(resetFormState);
      setPendingImageFile(null);
      setCheckInEvents(resetCheckInEvents);
      setApplicationTemplate([]);
      cleanSnapshot.current = createFormSnapshot(
        resetFormState,
        resetCheckInEvents,
        []
      );
    }

    if (onSuccess) {
      bypassUnsavedChangesWarning.current = true;
      onSuccess(finalEventId);
    } else {
      router.refresh();
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Delete related check-in sessions first
      try {
        await deleteCheckInSessionsForEvent(supabase, eventId);
      } catch (deleteCheckInError) {
        const message =
          deleteCheckInError instanceof Error
            ? deleteCheckInError.message
            : "Unknown error";
        setError(`Failed to delete check-in sessions: ${message}`);
        setIsDeleting(false);
        return;
      }

      // Delete related application questions
      try {
        await deleteApplicationQuestionsForEvent(supabase, eventId);
      } catch (deleteQuestionsError) {
        const message =
          deleteQuestionsError instanceof Error
            ? deleteQuestionsError.message
            : "Unknown error";
        setError(`Failed to delete application questions: ${message}`);
        setIsDeleting(false);
        return;
      }

      // Delete event registrations
      try {
        await deleteRegistrationsForEvent(supabase, eventId);
      } catch (deleteRegistrationsError) {
        const message =
          deleteRegistrationsError instanceof Error
            ? deleteRegistrationsError.message
            : "Unknown error";
        setError(`Failed to delete event registrations: ${message}`);
        setIsDeleting(false);
        return;
      }

      // Finally, delete the event itself
      try {
        await deleteEvent(supabase, eventId);
      } catch (deleteEventError) {
        const message =
          deleteEventError instanceof Error
            ? deleteEventError.message
            : "Unknown error";
        setError(`Failed to delete event: ${message}`);
        setIsDeleting(false);
        return;
      }

      // Success - redirect to events page
      setShowDeleteModal(false);
      bypassUnsavedChangesWarning.current = true;
      router.push("/admin/events");
    } catch {
      setError("An unexpected error occurred while deleting the event.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-semibold leading-none">
            {title ?? (eventId ? "Modify Event" : "Create Event")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {description ??
              (eventId
                ? "Update the details for this event."
                : "Provide the details for the new event.")}
          </p>
        </div>
        {eventId && (
          <div className="flex flex-col gap-2 md:flex-row md:ml-4">
            <Button
              type="button"
              variant="outline"
              asChild
              className="w-full md:w-auto"
            >
              <Link href={`/admin/events/${eventId}/check-in`}>Check-In</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              asChild
              className="w-full md:w-auto"
            >
              <Link href={`/admin/events/${eventId}/review-applications`}>
                Review Applications
              </Link>
            </Button>

            <BackButton
              link="/admin/events"
              label="Back to Events"
              className="mb-4"
            />
          </div>
        )}
      </div>
      <div>
        {loadingEvent ? (
          <div className="flex flex-col gap-6">
            {/* Basic Event Info Skeleton */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-40 w-full" />
              </div>
            </section>

            {/* Event Pricing Skeleton */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            </section>

            {/* Event Schedule Skeleton */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </section>

            {/* Event Location Skeleton */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            </section>

            {/* Registration Times Skeleton */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            </section>

            {/* Check-In Events Section Skeleton */}
            <section className="grid gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-9 w-32" />
              </div>
              <div className="border rounded-lg p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>
            </section>

            {/* Application Questions Section Skeleton */}
            <section className="grid gap-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-9 w-36" />
              </div>
              <div className="border rounded-lg p-4 space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Submit Button Skeleton */}
            <div className="flex justify-start">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <BasicEventInfo
              name={formState.name}
              description={formState.description}
              max_capacity={formState.max_capacity}
              image_url={formState.image_url}
              isSubmitting={isSubmitting}
              onImageFileChange={handleImageFileChange}
              onFieldChange={handleFieldChange}
            />

            <EventPricing
              regular_price={formState.regular_price}
              member_price={formState.member_price}
              onFieldChange={handleFieldChange}
            />

            <EventSchedule
              start_date={formState.start_date}
              start_time={formState.start_time}
              end_date={formState.end_date}
              end_time={formState.end_time}
              onFieldChange={handleFieldChange}
            />

            <EventLocation
              location_building={formState.location_building}
              location_room={formState.location_room}
              location_address_url={formState.location_address_url}
              onFieldChange={handleFieldChange}
            />

            <RegistrationTimes
              registration_start_time={formState.registration_start_time}
              registration_end_time={formState.registration_end_time}
              onFieldChange={handleFieldChange}
            />

            <CheckInEventsSection
              checkInEvents={checkInEvents}
              onAdd={addCheckInEvent}
              onRemove={removeCheckInEvent}
              onUpdate={updateCheckInEvent}
            />

            <ApplicationQuestionsSection
              applicationTemplate={applicationTemplate}
              questionErrors={questionErrors}
              onAdd={addApplicationQuestion}
              onRemove={removeApplicationQuestion}
              onUpdate={updateApplicationQuestion}
              onAddResponseOption={addResponseOption}
              onUpdateResponseOption={updateResponseOption}
              onRemoveResponseOption={removeResponseOption}
              onResponseTypeChange={handleResponseTypeChange}
            />

            {error && (
              <Field data-invalid>
                <FieldError>{error}</FieldError>
              </Field>
            )}
            {successMessage && (
              <Field>
                <FieldDescription className="text-green-600">
                  {successMessage}
                </FieldDescription>
              </Field>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto"
              >
                {isSubmitting
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
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isSubmitting || isDeleting}
                  className="w-full md:w-auto"
                >
                  Delete Event
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
      {eventId && (
        <DeleteEventModal
          eventName={formState.name}
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setError(null);
          }}
          onConfirm={handleDeleteEvent}
          isDeleting={isDeleting}
          error={error}
        />
      )}
    </div>
  );
};

export default EventCreateModify;
