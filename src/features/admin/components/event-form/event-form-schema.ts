import { dateLocationProblem, dateSessions, emptyEventDate, emptyLocation, type EventDateLocationDraft } from "../../lib/event-date-location";
import { parseEventDescription, type EventDescription } from "@/lib/event-description";
import { eventSlugError, priceError, suggestedEventSlug, websiteUrlError } from "../../lib/event-configuration";
import {
  ResponseType,
  type CheckInSessionRow,
  type EventApplicationQuestionRow,
  type EventRow,
  type EventStatus,
  type EventType,
} from "@/lib/supabase/models";
import type { ApplicationQuestionTemplate } from "@/features/events/types";
import type {
  ApplicationQuestionInput,
  CheckInSessionDraft,
  CheckInSessionInput,
} from "@/features/admin/types";
import { APPLICATION_FILE_MAX_BYTES } from "@/lib/supabase-helpers/application-files";
import {
  datetimeLocalToTimestamptz,
  timestamptzToDatetimeLocal,
  strictPacificTimestamp,
} from "@/lib/date";

export interface EventFormState {
  date_location: EventDateLocationDraft | null;
  date_location_revision: number;
  configuration_initialized: boolean;
  marketing_mode: "disabled" | "hosted" | "external";
  marketing_url: string;
  page_slug: string;
  slug_edited: boolean;
  is_featured: boolean;
  pricing_mode: "legacy" | "free" | "paid";
  pricing_amount: string;
  name: string;
  short_description: string;
  description: string;
  description_rich: EventDescription | null;
  header_image_url: string;
  header_colour: string;
  event_colour: string;
  status: EventStatus;
  publish_at: string;
  event_type: EventType;
  regular_price: string;
  member_price: string;
  location_building: string;
  location_room: string;
  location_address_url: string;
  /** Pacific wall-clock `YYYY-MM-DDTHH:mm`, like every date field below. */
  starts_at: string;
  ends_at: string;
  max_capacity: string;
  image_url: string;
  registration_opens_at: string;
  registration_closes_at: string;
  created_at: string;
  mentors_enabled: boolean;
  sponsors_enabled: boolean;
  requires_application: boolean;
  decisions_release_at: string;
  confirmation_deadline: string;
}

export interface MentorDraft {
  id?: string;
  isEditing?: boolean;
  full_name: string;
  position: string;
  linkedin_url: string;
  description: string;
  profile_image_path: string;
}

export interface SponsorDraft {
  id?: string;
  isEditing?: boolean;
  name: string;
  brand_logo_path: string;
}

export const EMPTY_CHECK_IN_SESSION: CheckInSessionDraft = {
  name: "",
  start_time: "",
  end_time: "",
};

export const defaultFormState: EventFormState = {
  date_location: null,
  date_location_revision: 0,
  configuration_initialized: true,
  marketing_mode: "hosted",
  marketing_url: "",
  page_slug: "",
  slug_edited: false,
  is_featured: false,
  pricing_mode: "free",
  pricing_amount: "0",
  name: "",
  short_description: "",
  description: "",
  description_rich: null,
  header_image_url: "",
  header_colour: "#325DC4",
  event_colour: "#325DC4",
  status: "draft",
  publish_at: "",
  event_type: "regular",
  regular_price: "",
  member_price: "",
  location_building: "",
  location_room: "",
  location_address_url: "",
  starts_at: "",
  ends_at: "",
  max_capacity: "",
  image_url: "",
  registration_opens_at: "",
  registration_closes_at: "",
  created_at: "",
  mentors_enabled: false,
  sponsors_enabled: false,
  requires_application: false,
  decisions_release_at: "",
  confirmation_deadline: "",
};

export function getInitialFormState(): EventFormState {
  return {
    ...defaultFormState,
    date_location: { automatic: true, audience: "everyone", location: emptyLocation(), dates: [emptyEventDate()] },
    starts_at: timestamptzToDatetimeLocal(new Date().toISOString()),
  };
}

/** The builder's form state for a stored event. */
export function formStateFromEvent(event: EventRow): EventFormState {
  return {
    date_location: null,
    date_location_revision: 0,
    configuration_initialized: true,
    marketing_mode: (event.configured_marketing_mode ?? (event.marketing_url ? "external" : "hosted")) as EventFormState["marketing_mode"],
    marketing_url: event.configured_marketing_url ?? event.marketing_url ?? "",
    page_slug: event.configured_slug ?? event.slug ?? "",
    slug_edited: event.configured_slug_edited ?? true,
    is_featured: event.is_featured,
    pricing_mode: (event.configured_pricing_mode ?? "legacy") as EventFormState["pricing_mode"],
    pricing_amount: String(event.configured_price ?? event.regular_price ?? ""),
    name: event.name ?? "",
    short_description: event.short_description ?? "",
    description: event.description ?? "",
    description_rich: parseEventDescription(event.description_rich),
    header_image_url: event.header_image_url ?? "",
    header_colour: event.header_colour ?? (event.header_image_url ? "" : "#325DC4"),
    event_colour: event.event_colour ?? "#325DC4",
    status: event.status,
    publish_at: timestamptzToDatetimeLocal(event.publish_at),
    event_type: event.event_type,
    regular_price: String(event.regular_price ?? ""),
    member_price: String(event.member_price ?? ""),
    location_building: event.location_building ?? "",
    location_room: event.location_room ?? "",
    location_address_url: event.location_address_url ?? "",
    starts_at: timestamptzToDatetimeLocal(event.starts_at),
    ends_at: timestamptzToDatetimeLocal(event.ends_at),
    max_capacity: String(event.max_capacity ?? ""),
    image_url: event.image_url ?? "",
    registration_opens_at: timestamptzToDatetimeLocal(
      event.registration_opens_at
    ),
    registration_closes_at: timestamptzToDatetimeLocal(
      event.registration_closes_at
    ),
    created_at: event.created_at ?? "",
    mentors_enabled: event.mentors_enabled,
    sponsors_enabled: event.sponsors_enabled,
    requires_application: event.requires_application,
    decisions_release_at: "",
    confirmation_deadline: "",
  };
}

/** The builder's application question drafts for stored questions. */
export function questionsFromRows(
  questions: EventApplicationQuestionRow[]
): ApplicationQuestionTemplate[] {
  return questions.map((question) => ({
    id: question.id,
    question: question.question ?? "",
    description: question.description ?? "",
    response: question.response_type,
    is_required: question.is_required,
    max_char_limit: question.max_char_limit ?? "",
    response_options: question.response_options ?? [],
  }));
}

/** The builder's check-in session drafts for stored sessions. */
export function checkInDraftsFromRows(
  sessions: (Pick<CheckInSessionRow, "name" | "start_time" | "end_time"> & { id?: string })[]
): CheckInSessionDraft[] {
  return sessions.map((session) => ({
    id: session.id,
    name: session.name ?? "",
    start_time: timestamptzToDatetimeLocal(session.start_time),
    end_time: timestamptzToDatetimeLocal(session.end_time),
  }));
}

export function isDateTimeRangeInvalid(start: string, end: string) {
  return Boolean(start && end && new Date(start) >= new Date(end));
}

/** Whether a date field holds both its date and its time. */
export function isCompleteDateTime(value: string) {
  return datetimeLocalToTimestamptz(value) !== null;
}

export function isEventScheduleRangeInvalid(formState: EventFormState) {
  const { starts_at, ends_at } = formState;
  if (!isCompleteDateTime(starts_at) || !isCompleteDateTime(ends_at))
    return false;
  return isDateTimeRangeInvalid(starts_at, ends_at);
}

export function createFormSnapshot(
  formState: EventFormState,
  checkInEvents: CheckInSessionDraft[],
  mentors: MentorDraft[],
  sponsors: SponsorDraft[],
  applicationTemplate: ApplicationQuestionTemplate[],
  pendingImageFile: File | null = null,
  pendingHeaderFile: File | null = null
) {
  return JSON.stringify({
    formState,
    checkInEvents,
    mentors,
    sponsors,
    applicationTemplate,
    pendingHeaderFile: pendingHeaderFile ? { name: pendingHeaderFile.name, size: pendingHeaderFile.size, lastModified: pendingHeaderFile.lastModified } : null,
    pendingImageFile: pendingImageFile
      ? {
          name: pendingImageFile.name,
          size: pendingImageFile.size,
          lastModified: pendingImageFile.lastModified,
        }
      : null,
  });
}

export function validateEventForm(
  formState: EventFormState,
  checkInEvents: CheckInSessionDraft[],
  applicationTemplate: ApplicationQuestionTemplate[],
  mentors: MentorDraft[] = [],
  sponsors: SponsorDraft[] = []
) {
  let error: string | null = null;
  if (formState.date_location) {
    error = dateLocationProblem(formState.date_location);
    if (error) return { error, questionErrors: {}, invalidSections: { mentors: false, sponsors: false, applications: false } };
    checkInEvents = dateSessions(formState.date_location).map(row => ({ ...row, id: row.id ?? undefined }));
  }
  const invalidSections = {
    mentors: mentors.some((mentor) => !mentor.full_name.trim()),
    sponsors: sponsors.some((sponsor) => !sponsor.name.trim()),
    applications: false,
  };
  if (!formState.name.trim()) error = "Event name is required.";
  else if (!formState.short_description.trim())
    error = "Short description is required.";
  else if (formState.short_description.length > 50) error = "Short overview must be 50 characters or fewer.";
  else if (formState.description.length > 3000) error = "Long overview must be 3,000 characters or fewer.";
  else if (!formState.description.trim()) error = "Description is required.";
  else if (formState.marketing_mode === "external" && websiteUrlError(formState.marketing_url))
    error = websiteUrlError(formState.marketing_url);
  else if (formState.marketing_mode === "hosted" && eventSlugError((formState.slug_edited ? formState.page_slug : formState.page_slug || suggestedEventSlug(formState.name))))
    error = eventSlugError((formState.slug_edited ? formState.page_slug : formState.page_slug || suggestedEventSlug(formState.name)));
  else if (formState.pricing_mode !== "legacy" && priceError(formState.pricing_mode === "free" ? "0" : formState.pricing_amount))
    error = priceError(formState.pricing_amount);
  else if (!formState.max_capacity || !/^\d+$/.test(formState.max_capacity) || Number(formState.max_capacity) < 0) error = "Capacity must be a nonnegative whole number.";
  else if (invalidSections.mentors)
    error = "Every mentor requires a full name.";
  else if (invalidSections.sponsors)
    error = "Every sponsor requires a name.";
  else if (formState.publish_at && formState.status !== "draft")
    error = "Only draft events can have a publish date.";
  else if (
    formState.publish_at &&
    timestamptzToDatetimeLocal(datetimeLocalToTimestamptz(formState.publish_at)) !==
      formState.publish_at
  )
    error = "Publish date must be a valid date and time in Pacific time.";
  else if (
    formState.publish_at &&
    Date.parse(datetimeLocalToTimestamptz(formState.publish_at)!) <= Date.now()
  )
    error = "Publish date must be in the future.";
  else if (
    !formState.date_location && (!isCompleteDateTime(formState.starts_at) ||
    !isCompleteDateTime(formState.ends_at))
  )
    error = "Event start and end dates and times are required.";
  else if (!formState.date_location && isEventScheduleRangeInvalid(formState))
    error = "Event end time must be after the start time.";
  else if (
    [formState.registration_opens_at, formState.registration_closes_at].some(
      (value) => value && !strictPacificTimestamp(value)
    )
  )
    error = "Registration dates require both a date and time.";
  else if (
    isDateTimeRangeInvalid(
      formState.registration_opens_at,
      formState.registration_closes_at
    )
  )
    error = "Registration end time must be after the start time.";
  else if (
    !checkInEvents.every(
      (item) => item.name && item.start_time && item.end_time
    )
  )
    error =
      "All check-in sessions require name, start time, and end time.";
  else if (
    checkInEvents.some((item) =>
      isDateTimeRangeInvalid(item.start_time, item.end_time)
    )
  )
    error = "Check-in end time must be after the start time.";

  const questionErrors: Record<number, string> = {};
  if (formState.requires_application && !applicationTemplate.length) questionErrors[-1] = "Applications require at least one valid question before publication.";
  applicationTemplate.forEach((item, index) => {
    if (!item.question.trim()) {
      questionErrors[index] = "Question is required.";
    } else if (
      (item.response === ResponseType.short_text ||
        item.response === ResponseType.long_text) &&
      item.max_char_limit !== "" &&
      (!Number.isSafeInteger(item.max_char_limit) || item.max_char_limit <= 0)
    ) {
      questionErrors[index] =
        "Text response questions require a maximum character limit greater than 0.";
    } else if (
      (item.response === ResponseType.checkbox ||
        item.response === ResponseType.multiple_choice ||
        item.response === ResponseType.dropdown) &&
      (!item.response_options?.length ||
        !item.response_options.every((option) => option.trim()))
    ) {
      questionErrors[index] =
        "Select response questions require at least one option.";
    }
  });
  invalidSections.applications = Object.keys(questionErrors).length > 0;

  if (!error) error = applicationTimingProblem(formState);

  if (!error && invalidSections.applications) {
    error = "Please fix the errors in application questions.";
  }

  return { error, questionErrors, invalidSections };
}

const isTextType = (response: ApplicationQuestionTemplate["response"]) =>
  response === ResponseType.short_text || response === ResponseType.long_text;

const isChoiceType = (response: ApplicationQuestionTemplate["response"]) =>
  response === ResponseType.checkbox ||
  response === ResponseType.multiple_choice ||
  response === ResponseType.dropdown;

/**
 * The builder's questions as the save sends them, in order. A saved question
 * keeps its id so the save updates it, and with it the answers to it, in
 * place; a new one has a null id. File questions carry the upload bucket's
 * fixed rule (one PDF, at most 5 MB), which the save applies regardless.
 */
export function toApplicationQuestionInputs(
  applicationTemplate: ApplicationQuestionTemplate[]
): ApplicationQuestionInput[] {
  return applicationTemplate.map((question, sortOrder) => {
    const isFile = question.response === ResponseType.file_upload;
    return {
      id: question.id ?? null,
      question: question.question,
      description: question.description || null,
      response_type: question.response,
      is_required: question.is_required,
      sort_order: sortOrder,
      max_char_limit: isTextType(question.response)
        ? question.max_char_limit === ""
          ? null
          : question.max_char_limit
        : null,
      response_options: isChoiceType(question.response)
        ? question.response_options || []
        : null,
      restrict_file_types: isFile,
      allowed_file_types: isFile ? ["pdf"] : null,
      max_file_size_bytes: isFile ? APPLICATION_FILE_MAX_BYTES : null,
    };
  });
}

/**
 * The builder's questions after a save, each with the id the save gave it
 * (`questionIds` is in the order the questions were sent), so the next save
 * updates them rather than adding them again.
 */
export function withSavedQuestionIds(
  applicationTemplate: ApplicationQuestionTemplate[],
  questionIds: string[]
): ApplicationQuestionTemplate[] {
  return applicationTemplate.map((question, index) => ({
    ...question,
    id: questionIds[index] ?? question.id,
  }));
}

/**
 * The builder's check-in sessions as the save sends them, in order. A saved
 * session keeps its id so the save updates it, and keeps the check-ins to it;
 * a new one has a null id. Only call this on a validated form: every time is
 * complete.
 */
export function toCheckInSessionInputs(
  checkInEvents: CheckInSessionDraft[]
): CheckInSessionInput[] {
  return checkInEvents.map((session) => ({
    id: session.id ?? null,
    name: session.name,
    start_time: datetimeLocalToTimestamptz(session.start_time)!,
    end_time: datetimeLocalToTimestamptz(session.end_time)!,
  }));
}

/**
 * The builder's check-in sessions after a save, each with the id the save gave
 * it (`sessionIds` is in the order the sessions were sent), so the next save
 * updates them rather than adding them again.
 */
export function withSavedCheckInSessionIds(
  checkInEvents: CheckInSessionDraft[],
  sessionIds: string[]
): CheckInSessionDraft[] {
  return checkInEvents.map((session, index) => ({
    ...session,
    id: sessionIds[index] ?? session.id,
  }));
}

/** Validate complete Pacific moments without making historical edits expire. */
export function applicationTimingProblem(state: Pick<EventFormState, "decisions_release_at" | "confirmation_deadline">) {
  const release = state.decisions_release_at;
  const confirm = state.confirmation_deadline;
  if ([release, confirm].some(value => value && !strictPacificTimestamp(value))) return "Application timing requires a valid, unambiguous Pacific date and time.";
  if (release && confirm && strictPacificTimestamp(confirm)! <= strictPacificTimestamp(release)!) return "Confirm by must be later than Release decisions on.";
  return null;
}
