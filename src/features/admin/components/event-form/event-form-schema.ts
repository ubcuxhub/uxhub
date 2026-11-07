import { eventSlugError, priceError, suggestedEventSlug, websiteUrlError } from "../../lib/event-configuration";
import type { EventDescription } from "@/lib/event-description";
import {
  ResponseType,
  type EventStatus,
  type EventType,
} from "@/lib/supabase/models";
import type { ApplicationQuestionTemplate } from "@/features/events/types";
import type { CheckInSessionDraft } from "@/features/admin/types";
import {
  datetimeLocalToTimestamptz,
  timestamptzToDatetimeLocal,
} from "@/lib/date";

export interface EventFormState {
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
};

export function getInitialFormState(): EventFormState {
  return {
    ...defaultFormState,
    starts_at: timestamptzToDatetimeLocal(new Date().toISOString()),
  };
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
  else if (!formState.max_capacity) error = "Max capacity is required.";
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
    !isCompleteDateTime(formState.starts_at) ||
    !isCompleteDateTime(formState.ends_at)
  )
    error = "Event start and end dates and times are required.";
  else if (isEventScheduleRangeInvalid(formState))
    error = "Event end time must be after the start time.";
  else if (
    [formState.registration_opens_at, formState.registration_closes_at].some(
      (value) => value && !isCompleteDateTime(value)
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
  applicationTemplate.forEach((item, index) => {
    if (!item.question.trim()) {
      questionErrors[index] = "Question is required.";
    } else if (
      (item.response === ResponseType.short_text ||
        item.response === ResponseType.long_text) &&
      item.max_char_limit !== "" &&
      item.max_char_limit <= 0
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
    } else if (
      item.response === ResponseType.file_upload &&
      item.restrict_file_types &&
      item.allowed_file_types.length === 0
    ) {
      questionErrors[index] =
        "File upload questions require at least one allowed file type.";
    } else if (
      item.response === ResponseType.file_upload &&
      item.max_file_size_bytes !== "" &&
      item.max_file_size_bytes <= 0
    ) {
      questionErrors[index] = "Maximum file size must be greater than zero.";
    }
  });
  invalidSections.applications = Object.keys(questionErrors).length > 0;

  if (!error && invalidSections.applications) {
    error = "Please fix the errors in application questions.";
  }

  return { error, questionErrors, invalidSections };
}
