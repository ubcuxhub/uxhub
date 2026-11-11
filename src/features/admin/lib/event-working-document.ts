import { parseDateLocationDraft } from "./event-date-location";
import type { CheckInSessionDraft } from "@/features/admin/types";
import { ResponseType, type ApplicationQuestionTemplate } from "@/features/events/types";
import { defaultFormState, type EventFormState, type MentorDraft, type SponsorDraft } from "../components/event-form/event-form-schema";
import { parseEventDescription, descriptionText } from "@/lib/event-description";

export interface EventWorkingDocument {
  version: 1;
  formState: EventFormState;
  checkInEvents: CheckInSessionDraft[];
  mentors: MentorDraft[];
  sponsors: SponsorDraft[];
  applicationTemplate: ApplicationQuestionTemplate[];
}

/** Working documents permit incomplete values, but never executable URLs or files. */
export function parseWorkingDocument(input: unknown): EventWorkingDocument {
  if (!input || typeof input !== "object") throw new Error("Invalid draft document.");
  const document = input as EventWorkingDocument;
  if (document.version !== 1 || !document.formState || JSON.stringify(input).length > 500000) throw new Error("Invalid draft document.");
  const state = { ...defaultFormState, ...document.formState };
  // Version-one documents predate configuration. Preserve both old amounts
  // until staff deliberately select the new pricing policy.
  if (!("pricing_mode" in document.formState)) {
    state.pricing_mode = "legacy";
    state.configuration_initialized = false;
  }
  if (!("teams_enabled" in document.formState)) state.teams_configuration_initialized = false;
  if (!("agenda_enabled" in document.formState)) state.schedule_configuration_initialized = false;
  for (const [key, initial] of Object.entries(defaultFormState)) {
    const value = state[key as keyof EventFormState];
    if (key === "date_location") {
      if (value !== null) parseDateLocationDraft(value);
    } else if (key === "description_rich") {
      if (value !== null && !parseEventDescription(value)) throw new Error("Invalid long overview formatting.");
    } else if (typeof value !== typeof initial) throw new Error("Invalid draft field.");
  }
  if (!["disabled", "hosted", "external"].includes(state.marketing_mode) || !["legacy", "free", "paid"].includes(state.pricing_mode)) throw new Error("Invalid draft configuration.");
  if (state.short_description.length > 50 || state.description.length > 3000) throw new Error("Overview exceeds its character limit.");
  if (state.description_rich && descriptionText(state.description_rich) !== state.description) throw new Error("Invalid long overview formatting.");
  for (const key of ["image_url", "header_image_url"] as const) {
    if (state[key] && !/^https?:\/\//i.test(state[key]) && !state[key].startsWith("/")) throw new Error("Upload the selected image before saving.");
  }
  for (const key of ["checkInEvents", "mentors", "sponsors", "applicationTemplate"] as const) {
    if (!Array.isArray(document[key]) || document[key].some(item => !item || typeof item !== "object") || document[key].length > 500) throw new Error("Invalid draft sections.");
  }
  for (const session of document.checkInEvents) if ([session.name, session.start_time, session.end_time].some(value => typeof value !== "string") || (session.id !== undefined && typeof session.id !== "string")) throw new Error("Invalid draft check-in session.");
  for (const mentor of document.mentors) if ([mentor.full_name, mentor.position, mentor.linkedin_url, mentor.description, mentor.profile_image_path].some(value => typeof value !== "string") || (mentor.id !== undefined && typeof mentor.id !== "string")) throw new Error("Invalid draft mentor.");
  for (const sponsor of document.sponsors) if ([sponsor.name, sponsor.brand_logo_path].some(value => typeof value !== "string") || (sponsor.id !== undefined && typeof sponsor.id !== "string")) throw new Error("Invalid draft sponsor.");
  for (const question of document.applicationTemplate) {
    if (typeof question.question !== "string" || typeof question.description !== "string" || !Object.values(ResponseType).includes(question.response) || typeof question.is_required !== "boolean" || (question.id !== undefined && typeof question.id !== "string") || (!Array.isArray(question.response_options) || question.response_options.some(value => typeof value !== "string")) || (question.max_char_limit !== "" && (typeof question.max_char_limit !== "number" || !Number.isFinite(question.max_char_limit)))) throw new Error("Invalid draft question.");
  }
  return { ...document, formState: Object.fromEntries(Object.keys(defaultFormState).map(key => [key, state[key as keyof EventFormState]])) as unknown as EventFormState };
}
