"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import {
  ResponseType,
  type ApplicationQuestionTemplate,
} from "@/features/events/types/eventTypes";
import type { EventApplicationQuestionInsert } from "@/types/models";
import type { CheckInSessionDraft } from "../types/checkInTypes";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const [formState, setFormState] = useState<EventFormState>(defaultFormState);
  const [checkInEvents, setCheckInEvents] = useState<CheckInSessionDraft[]>([
    { name: "", start_time: "", end_time: "" },
  ]);
  const [applicationTemplate, setApplicationTemplate] = useState<
    ApplicationQuestionTemplate[]
  >([
    {
      question: "",
      response: ResponseType.text,
      max_char_limit: 0,
      response_options: [],
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(!!eventId);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {}
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
            setFormState(parsed.formState || defaultFormState);
            setCheckInEvents(
              parsed.checkInEvents || [
                { name: "", start_time: "", end_time: "" },
              ]
            );
            setApplicationTemplate(
              parsed.applicationTemplate || [
                {
                  question: "",
                  response: ResponseType.text,
                  max_char_limit: 0,
                  response_options: [],
                },
              ]
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
    const fetchExistingEvent = async () => {
      if (!eventId) return;

      setLoadingEvent(true);
      setError(null);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoadingEvent(false);
        return;
      }

      if (!data) {
        setError("Event not found.");
        setLoadingEvent(false);
        return;
      }

      setFormState({
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
      });

      // Fetch check-in sessions from check_in_sessions table
      const { data: checkInSessionsData, error: checkInSessionsError } =
        await supabase
          .from("check_in_sessions")
          .select("*")
          .eq("event_id", eventId)
          .order("start_time", { ascending: true });

      if (checkInSessionsError) {
        console.error(
          "Error fetching check-in sessions:",
          checkInSessionsError
        );
        setCheckInEvents([{ name: "", start_time: "", end_time: "" }]);
      } else if (checkInSessionsData && checkInSessionsData.length > 0) {
        setCheckInEvents(
          checkInSessionsData.map((session) => ({
            name: session.name ?? "",
            start_time: timestamptzToDatetimeLocal(session.start_time),
            end_time: timestamptzToDatetimeLocal(session.end_time),
          }))
        );
      } else {
        setCheckInEvents([{ name: "", start_time: "", end_time: "" }]);
      }

      // Fetch application questions from event_application_questions table
      const { data: questionsData, error: questionsError } = await supabase
        .from("event_application_questions")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (questionsError) {
        console.error("Error fetching application questions:", questionsError);
        setApplicationTemplate([
          {
            question: "",
            response: ResponseType.text,
            max_char_limit: 0,
            response_options: [],
          },
        ]);
      } else if (questionsData && questionsData.length > 0) {
        setApplicationTemplate(
          questionsData.map((q) => ({
            question: q.question ?? "",
            response: (q.response_type as ResponseType) ?? ResponseType.text,
            max_char_limit: q.max_char_limit ?? 0,
            response_options: q.response_options ?? [],
          }))
        );
      } else {
        setApplicationTemplate([
          {
            question: "",
            response: ResponseType.text,
            max_char_limit: 0,
            response_options: [],
          },
        ]);
      }

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
                  ? Number(value)
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
        max_char_limit: 0,
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
              ...(newResponseType === ResponseType.text && q.max_char_limit <= 0
                ? { max_char_limit: 100 }
                : {}),
            }
          : q
      )
    );
  };

  const validateForm = () => {
    if (!formState.name.trim()) return "Event name is required.";
    if (!formState.start_date) return "Event start date is required.";
    if (!formState.start_time) return "Event start time is required.";
    // location_building and location_room are now optional
    if (!formState.location_address_url.trim())
      return "Location address URL is required.";
    if (!formState.description.trim()) return "Description is required.";
    if (!formState.regular_price.trim()) return "Regular price is required.";
    if (Number.isNaN(Number(formState.regular_price)))
      return "Regular price must be a valid number.";
    if (!formState.member_price.trim()) return "Member price is required.";
    if (Number.isNaN(Number(formState.member_price)))
      return "Member price must be a valid number.";
    if (!formState.max_capacity) return "Max capacity is required.";
    if (
      !checkInEvents.every(
        (item) => item.name && item.start_time && item.end_time
      )
    )
      return "All check-in sessions require name, start time, and end time.";

    // Validate application questions and track errors per question
    const newQuestionErrors: Record<number, string> = {};
    if (applicationTemplate.length > 0) {
      for (let i = 0; i < applicationTemplate.length; i++) {
        const item = applicationTemplate[i];
        if (!item.question.trim()) {
          newQuestionErrors[i] = "Question is required.";
        } else {
          if (item.response === ResponseType.text) {
            if (item.max_char_limit <= 0) {
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
      const { data: existingSlugs, error: slugFetchError } = await supabase
        .from("events")
        .select("slug")
        .ilike("slug", `${baseSlug}%`);

      if (slugFetchError) {
        setError(`Failed to prepare event slug: ${slugFetchError.message}`);
        setIsSubmitting(false);
        return;
      }

      eventSlug = createUniqueSlug(
        formState.name,
        existingSlugs?.map((item) => item.slug) ?? [],
        "event"
      );
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
    if (formState.image_url) {
      payload.image_url = formState.image_url;
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
    const query = eventId
      ? supabase.from("events").update(payload).eq("id", eventId)
      : supabase.from("events").insert({
          ...payload,
          slug: eventSlug ?? "event",
        });

    const { data, error: upsertError } = await query.select("id").maybeSingle();

    if (upsertError) {
      setError(upsertError.message);
      setIsSubmitting(false);
      return;
    }

    if (!data?.id) {
      setError("No event id returned from Supabase.");
      setIsSubmitting(false);
      return;
    }

    const finalEventId = data.id;

    // If updating, delete existing check-in sessions and application questions
    if (eventId) {
      const { error: deleteCheckInError } = await supabase
        .from("check_in_sessions")
        .delete()
        .eq("event_id", eventId);

      if (deleteCheckInError) {
        setError(
          `Failed to delete existing check-in sessions: ${deleteCheckInError.message}`
        );
        setIsSubmitting(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("event_application_questions")
        .delete()
        .eq("event_id", eventId);

      if (deleteError) {
        setError(`Failed to delete existing questions: ${deleteError.message}`);
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

        const { error: checkInSessionsError } = await supabase
          .from("check_in_sessions")
          .insert(sessionsToInsert);

        if (checkInSessionsError) {
          setError(
            `Failed to save check-in sessions: ${checkInSessionsError.message}`
          );
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
            questionData.max_char_limit = q.max_char_limit;
          } else if (
            q.response === ResponseType.multi_select ||
            q.response === ResponseType.single_select
          ) {
            questionData.response_options = q.response_options || [];
          }

          return questionData;
        });

        const { error: questionsError } = await supabase
          .from("event_application_questions")
          .insert(questionsToInsert);

        if (questionsError) {
          setError(
            `Failed to save application questions: ${questionsError.message}`
          );
          setIsSubmitting(false);
          return;
        }
      }
    }

    setSuccessMessage(
      eventId ? "Event updated successfully." : "Event created successfully."
    );
    setIsSubmitting(false);
    if (!eventId) {
      // Clear persisted state after successful creation
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      setFormState(defaultFormState);
      setCheckInEvents([{ name: "", start_time: "", end_time: "" }]);
      setApplicationTemplate([
        {
          question: "",
          response: ResponseType.text,
          max_char_limit: 0,
          response_options: [],
        },
      ]);
    }

    if (onSuccess) {
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
      const { error: deleteCheckInError } = await supabase
        .from("check_in_sessions")
        .delete()
        .eq("event_id", eventId);

      if (deleteCheckInError) {
        setError(
          `Failed to delete check-in sessions: ${deleteCheckInError.message}`
        );
        setIsDeleting(false);
        return;
      }

      // Delete related application questions
      const { error: deleteQuestionsError } = await supabase
        .from("event_application_questions")
        .delete()
        .eq("event_id", eventId);

      if (deleteQuestionsError) {
        setError(
          `Failed to delete application questions: ${deleteQuestionsError.message}`
        );
        setIsDeleting(false);
        return;
      }

      // Delete event registrations
      const { error: deleteRegistrationsError } = await supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", eventId);

      if (deleteRegistrationsError) {
        setError(
          `Failed to delete event registrations: ${deleteRegistrationsError.message}`
        );
        setIsDeleting(false);
        return;
      }

      // Finally, delete the event itself
      const { error: deleteEventError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (deleteEventError) {
        setError(`Failed to delete event: ${deleteEventError.message}`);
        setIsDeleting(false);
        return;
      }

      // Success - redirect to events page
      setShowDeleteModal(false);
      router.push("/admin/events");
    } catch {
      setError("An unexpected error occurred while deleting the event.");
      setIsDeleting(false);
    }
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <CardTitle>
              {title ?? (eventId ? "Modify Event" : "Create Event")}
            </CardTitle>
            <CardDescription>
              {description ??
                (eventId
                  ? "Update the details for this event."
                  : "Provide the details for the new event.")}
            </CardDescription>
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
      </CardHeader>
      <CardContent>
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

            {error && <p className="text-sm text-red-500">{error}</p>}
            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}

            <CardFooter className="px-0 flex gap-2">
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
            </CardFooter>
          </form>
        )}
      </CardContent>
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
    </Card>
  );
};

export default EventCreateModify;
