import {
  ResponseType,
  type EventStatus,
  type EventType,
} from "@/types/models";
import type { ApplicationQuestionTemplate } from "@/features/events/types/eventTypes";
import type { CheckInSessionDraft } from "@/features/admin/types/checkInTypes";
import { getPacificStartDefaults } from "@/lib/date";

export interface EventFormState {
  name: string;
  short_description: string;
  description: string;
  status: EventStatus;
  event_type: EventType;
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
  mentors_enabled: boolean;
  sponsors_enabled: boolean;
  applications_enabled: boolean;
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
  name: "",
  short_description: "",
  description: "",
  status: "draft",
  event_type: "regular",
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
  mentors_enabled: false,
  sponsors_enabled: false,
  applications_enabled: false,
};

export function getInitialFormState(): EventFormState {
  return { ...defaultFormState, ...getPacificStartDefaults() };
}

export function isFreePricing(regularPrice: string, memberPrice: string) {
  return (
    regularPrice !== "" &&
    memberPrice !== "" &&
    Number(regularPrice) === 0 &&
    Number(memberPrice) === 0
  );
}

export function isDateTimeRangeInvalid(start: string, end: string) {
  return Boolean(start && end && new Date(start) >= new Date(end));
}

export function isEventScheduleRangeInvalid(formState: EventFormState) {
  const { start_date, start_time, end_date, end_time } = formState;
  if (!start_date || !start_time || !end_date || !end_time) return false;
  return isDateTimeRangeInvalid(
    `${start_date}T${start_time}`,
    `${end_date}T${end_time}`
  );
}

export function createFormSnapshot(
  formState: EventFormState,
  checkInEvents: CheckInSessionDraft[],
  mentors: MentorDraft[],
  sponsors: SponsorDraft[],
  applicationTemplate: ApplicationQuestionTemplate[],
  pendingImageFile: File | null = null
) {
  return JSON.stringify({
    formState,
    checkInEvents,
    mentorIds: mentors.map((mentor) => mentor.id ?? null),
    sponsorIds: sponsors.map((sponsor) => sponsor.id ?? null),
    applicationTemplate,
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
  else if (!formState.description.trim()) error = "Description is required.";
  else if (!formState.regular_price.trim()) error = "Regular price is required.";
  else if (Number.isNaN(Number(formState.regular_price)))
    error = "Regular price must be a valid number.";
  else if (!formState.member_price.trim()) error = "Member price is required.";
  else if (Number.isNaN(Number(formState.member_price)))
    error = "Member price must be a valid number.";
  else if (!formState.max_capacity) error = "Max capacity is required.";
  else if (invalidSections.mentors)
    error = "Every mentor requires a full name.";
  else if (invalidSections.sponsors)
    error = "Every sponsor requires a name.";
  else if (isEventScheduleRangeInvalid(formState))
    error = "Event end time must be after the start time.";
  else if (
    isDateTimeRangeInvalid(
      formState.registration_start_time,
      formState.registration_end_time
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
