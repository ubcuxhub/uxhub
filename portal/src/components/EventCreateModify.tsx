"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import type {
  ApplicationQuestionTemplate,
  CheckInEvent,
} from "@/lib/types/eventTypes";
import { ResponseType } from "@/lib/types/eventTypes";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ImageUpload";

interface EventCreateModifyProps {
  eventId?: string;
  onSuccess?: (id: string) => void;
  title?: string;
  description?: string;
}

interface EventFormState {
  name: string;
  event_date: string;
  event_time: string;
  location_building: string;
  location_room: string;
  location_address_url: string;
  price: string;
  description: string;
  max_capacity: string;
  image_url: string;
  created_at: string;
}

const defaultFormState: EventFormState = {
  name: "",
  event_date: "",
  event_time: "",
  location_building: "",
  location_room: "",
  location_address_url: "",
  price: "",
  description: "",
  max_capacity: "",
  image_url: "",
  created_at: "",
};

export const EventCreateModify = ({
  eventId,
  onSuccess,
  title,
  description,
}: EventCreateModifyProps) => {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [formState, setFormState] = useState<EventFormState>(defaultFormState);
  const [checkInEvents, setCheckInEvents] = useState<CheckInEvent[]>([
    { name: "", location: "", date: "", time: "" },
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
        event_date: data.event_date ?? "",
        event_time: data.event_time ?? "",
        location_building: data.location_building ?? "",
        location_room: data.location_room ?? "",
        location_address_url: data.location_address_url ?? "",
        price:
          data.price !== null && data.price !== undefined
            ? String(data.price)
            : "",
        description: data.description ?? "",
        max_capacity:
          data.max_capacity !== null && data.max_capacity !== undefined
            ? String(data.max_capacity)
            : "",
        image_url: data.image_url ?? "",
        created_at: data.created_at ?? "",
      });

      setCheckInEvents(
        Array.isArray(data.check_in_events) && data.check_in_events.length > 0
          ? data.check_in_events
          : [{ name: "", location: "", date: "", time: "" }]
      );

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
            response: (q.response as ResponseType) ?? ResponseType.text,
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
    field: keyof CheckInEvent,
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
      { name: "", location: "", date: "", time: "" },
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

  const validateForm = () => {
    if (!formState.name.trim()) return "Event name is required.";
    if (!formState.event_date) return "Event date is required.";
    if (!formState.event_time) return "Event time is required.";
    // location_building and location_room are now optional
    if (!formState.location_address_url.trim())
      return "Location address URL is required.";
    if (!formState.description.trim()) return "Description is required.";
    if (!formState.max_capacity) return "Max capacity is required.";
    if (
      !checkInEvents.every(
        (item) => item.name && item.location && item.date && item.time
      )
    )
      return "All check-in events require name, location, date, and time.";

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

    if (!formState.price.trim()) return "Price is required.";
    if (Number.isNaN(Number(formState.price)))
      return "Price must be a valid number.";

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
    // Prepare payload without application_template
    const payload = {
      ...formState,
      price: Number(formState.price),
      max_capacity: String(formState.max_capacity),
      check_in_events: checkInEvents,
      created_at: formState.created_at || new Date().toISOString(),
    };

    if (!formState.image_url) {
      (payload as { image_url?: string | null }).image_url = null;
    }

    // First, insert or update the event
    const query = eventId
      ? supabase.from("events").update(payload).eq("id", eventId)
      : supabase.from("events").insert(payload);

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

    // If updating, delete existing application questions
    if (eventId) {
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

    // Insert application questions if there are any
    if (applicationTemplate.length > 0) {
      // Filter out empty questions (where question is empty)
      const validQuestions = applicationTemplate.filter((q) =>
        q.question.trim()
      );

      if (validQuestions.length > 0) {
        const questionsToInsert = validQuestions.map((q) => {
          const questionData: {
            event_id: string;
            question: string;
            response: string;
            max_char_limit?: number;
            response_options?: string[];
          } = {
            event_id: finalEventId,
            question: q.question,
            response: q.response,
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
      setFormState(defaultFormState);
      setCheckInEvents([{ name: "", location: "", date: "", time: "" }]);
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
                <Link href={`/admin/events/${eventId}/check-in`}>
                  Check-In
                </Link>
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
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingEvent ? (
          <p className="text-sm text-muted-foreground">
            Loading event details...
          </p>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Event Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">
                  Price <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.price}
                  onChange={(e) => handleFieldChange("price", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event_date">
                  Event Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formState.event_date}
                  onChange={(e) =>
                    handleFieldChange("event_date", e.target.value)
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event_time">
                  Event Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="event_time"
                  type="time"
                  value={formState.event_time}
                  onChange={(e) =>
                    handleFieldChange("event_time", e.target.value)
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_capacity">
                  Max Capacity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="0"
                  value={formState.max_capacity}
                  onChange={(e) =>
                    handleFieldChange("max_capacity", e.target.value)
                  }
                  required
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <ImageUpload
                  value={formState.image_url}
                  onChange={(path) => handleFieldChange("image_url", path)}
                  eventName={formState.name || "event"}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location_building">Location Building</Label>
                <Input
                  id="location_building"
                  value={formState.location_building}
                  onChange={(e) =>
                    handleFieldChange("location_building", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location_room">Location Room</Label>
                <Input
                  id="location_room"
                  value={formState.location_room}
                  onChange={(e) =>
                    handleFieldChange("location_room", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="location_address_url">
                  Location Address URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="location_address_url"
                  type="url"
                  value={formState.location_address_url}
                  onChange={(e) =>
                    handleFieldChange("location_address_url", e.target.value)
                  }
                  required
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="description"
                  className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formState.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  required
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Check-In Events</h3>
                  <p className="text-sm text-muted-foreground">
                    Provide the check-in details for attendees. Each entry must
                    include a location, date, and time.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCheckInEvent}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                {checkInEvents.map((item, index) => (
                  <div
                    key={`check-in-${index}`}
                    className="grid gap-3 rounded-lg border p-4"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor={`check_name_${index}`}>
                        Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`check_name_${index}`}
                        value={item.name}
                        onChange={(e) =>
                          updateCheckInEvent(index, "name", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor={`check_location_${index}`}>
                          Location <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`check_location_${index}`}
                          value={item.location}
                          onChange={(e) =>
                            updateCheckInEvent(
                              index,
                              "location",
                              e.target.value
                            )
                          }
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`check_date_${index}`}>
                          Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`check_date_${index}`}
                          type="date"
                          value={item.date}
                          onChange={(e) =>
                            updateCheckInEvent(index, "date", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`check_time_${index}`}>
                          Time <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`check_time_${index}`}
                          type="time"
                          value={item.time}
                          onChange={(e) =>
                            updateCheckInEvent(index, "time", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => removeCheckInEvent(index)}
                        disabled={checkInEvents.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Application Questions
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Define any application questions attendees must answer.
                    (Optional)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addApplicationQuestion}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                {applicationTemplate.map((question, index) => (
                  <div
                    key={`application-${index}`}
                    className="grid gap-3 rounded-lg border p-4 md:grid-cols-3"
                  >
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor={`question_${index}`}>
                        Question <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`question_${index}`}
                        value={question.question}
                        onChange={(e) =>
                          updateApplicationQuestion(
                            index,
                            "question",
                            e.target.value
                          )
                        }
                        required
                        className={
                          questionErrors[index]
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }
                      />
                      {questionErrors[index] && (
                        <p className="text-sm text-red-500">
                          {questionErrors[index]}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`response_${index}`}>Response Type</Label>
                      <select
                        id={`response_${index}`}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={question.response}
                        onChange={(e) => {
                          const newResponseType = e.target
                            .value as ResponseType;
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
                                    ...(newResponseType ===
                                      ResponseType.multi_select ||
                                    newResponseType ===
                                      ResponseType.single_select
                                      ? {
                                          response_options:
                                            q.response_options || [],
                                        }
                                      : {}),
                                    ...(newResponseType === ResponseType.text &&
                                    q.max_char_limit <= 0
                                      ? { max_char_limit: 100 }
                                      : {}),
                                  }
                                : q
                            )
                          );
                        }}
                        required
                      >
                        {Object.values(ResponseType).map((value) => (
                          <option key={value} value={value}>
                            {value.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 md:col-span-3">
                      {question.response === ResponseType.text ? (
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="grid gap-2 md:col-span-1">
                            <Label htmlFor={`max_char_limit_${index}`}>
                              Max Character Limit{" "}
                              <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`max_char_limit_${index}`}
                              type="number"
                              min="1"
                              value={question.max_char_limit}
                              onChange={(e) =>
                                updateApplicationQuestion(
                                  index,
                                  "max_char_limit",
                                  Number(e.target.value)
                                )
                              }
                              required
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="md:col-span-2 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => removeApplicationQuestion(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between">
                            <Label>Response Options</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addResponseOption(index)}
                            >
                              Add Option
                            </Button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {(question.response_options || []).map(
                              (option, optionIndex) => (
                                <div
                                  key={`option-${index}-${optionIndex}`}
                                  className="flex gap-2"
                                >
                                  <Input
                                    value={option}
                                    onChange={(e) =>
                                      updateResponseOption(
                                        index,
                                        optionIndex,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter option text"
                                    required
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 shrink-0"
                                    onClick={() =>
                                      removeResponseOption(index, optionIndex)
                                    }
                                    disabled={
                                      (question.response_options || [])
                                        .length === 0
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              )
                            )}
                            {(!question.response_options ||
                              question.response_options.length === 0) && (
                              <p className="text-sm text-muted-foreground">
                                No options added. Click &quot;Add Option&quot;
                                to add selection options.
                              </p>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => removeApplicationQuestion(index)}
                            >
                              Remove Question
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}

            <CardFooter className="px-0">
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
            </CardFooter>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default EventCreateModify;
