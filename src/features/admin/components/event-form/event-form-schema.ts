import { ResponseType } from "@/types/models";
import type { ApplicationQuestionTemplate } from "@/features/events/types/eventTypes";
import type { CheckInSessionDraft } from "@/features/admin/types/checkInTypes";
import { getPacificStartDefaults } from "@/lib/date";

export interface EventFormState {
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

export const EMPTY_CHECK_IN_SESSION: CheckInSessionDraft = {
  name: "",
  start_time: "",
  end_time: "",
};

export const defaultFormState: EventFormState = {
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

export function getInitialFormState(): EventFormState {
  return { ...defaultFormState, ...getPacificStartDefaults() };
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
  applicationTemplate: ApplicationQuestionTemplate[],
  pendingImageFile: File | null = null
) {
  return JSON.stringify({
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
  });
}

export function validateEventForm(
  formState: EventFormState,
  checkInEvents: CheckInSessionDraft[],
  applicationTemplate: ApplicationQuestionTemplate[]
) {
  let error: string | null = null;
  if (!formState.name.trim()) error = "Event name is required.";
  else if (!formState.description.trim()) error = "Description is required.";
  else if (!formState.regular_price.trim()) error = "Regular price is required.";
  else if (Number.isNaN(Number(formState.regular_price)))
    error = "Regular price must be a valid number.";
  else if (!formState.member_price.trim()) error = "Member price is required.";
  else if (Number.isNaN(Number(formState.member_price)))
    error = "Member price must be a valid number.";
  else if (!formState.max_capacity) error = "Max capacity is required.";
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
      item.response === ResponseType.text &&
      item.max_char_limit !== "" &&
      item.max_char_limit <= 0
    ) {
      questionErrors[index] =
        "Text response questions require a maximum character limit greater than 0.";
    } else if (
      (item.response === ResponseType.multi_select ||
        item.response === ResponseType.single_select) &&
      (!item.response_options?.length ||
        !item.response_options.every((option) => option.trim()))
    ) {
      questionErrors[index] =
        "Select response questions require at least one option.";
    }
  });

  if (!error && Object.keys(questionErrors).length > 0) {
    error = "Please fix the errors in application questions.";
  }

  return { error, questionErrors };
}
