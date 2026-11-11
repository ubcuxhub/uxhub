import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

export type AppSettingsRow = Tables<"app_settings">;
export type AppSettingsUpdate = TablesUpdate<"app_settings">;

export type EventContentSettingsRow = Tables<"event_content_settings">;

export type EventRow = Tables<"events">;
export type EventInsert = TablesInsert<"events">;
export type EventUpdate = TablesUpdate<"events">;
export type EventStatus = Enums<"event_status">;
export type EventType = Enums<"event_type">;

export type MentorRow = Tables<"mentors">;
export type SponsorRow = Tables<"sponsors">;
export type EventMentorInsert = TablesInsert<"event_mentors">;
export type EventPeopleSectionRow = Tables<"event_people_sections">;
export type EventPeopleSectionInsert = TablesInsert<"event_people_sections">;
export type EventSponsorInsert = TablesInsert<"event_sponsors">;

export type TeamRow = Tables<"teams">;
export type TeamMemberRow = Tables<"team_members">;

export type EventLinkRow = Tables<"event_links">;
export type EventLinkInsert = TablesInsert<"event_links">;
export type EventPrivateDetailsRow = Tables<"event_private_details">;

export type UserInfoRow = Tables<"user_info">;
export type UserInfoInsert = TablesInsert<"user_info">;
export type UserInfoUpdate = TablesUpdate<"user_info">;

export type MembershipTypeRow = Tables<"membership_types">;
export type MembershipTypeInsert = TablesInsert<"membership_types">;
export type MembershipTypeUpdate = TablesUpdate<"membership_types">;

export type PurchaseRow = Tables<"purchases">;
export type PurchaseInsert = TablesInsert<"purchases">;
export type PurchaseUpdate = TablesUpdate<"purchases">;

export type SquareWebhookEventRow = Tables<"square_webhook_events">;
export type SquareWebhookEventInsert = TablesInsert<"square_webhook_events">;
export type SquareWebhookEventUpdate = TablesUpdate<"square_webhook_events">;

export type EventTicketRow = Tables<"event_tickets">;

export type EventApplicationSettingsRow = Tables<"event_application_settings">;

export type EventApplicationRow = Tables<"event_applications">;
export type EventApplicationInsert = TablesInsert<"event_applications">;
export type EventApplicationUpdate = TablesUpdate<"event_applications">;

export type EventApplicationQuestionRow =
  Tables<"event_application_questions">;
export type EventApplicationQuestionInsert =
  TablesInsert<"event_application_questions">;
export type EventApplicationQuestionUpdate =
  TablesUpdate<"event_application_questions">;

export type EventApplicationResponseRow =
  Tables<"event_application_responses">;
export type EventApplicationResponseInsert =
  TablesInsert<"event_application_responses">;
export type EventApplicationResponseUpdate =
  TablesUpdate<"event_application_responses">;

export type CheckInSessionRow = Tables<"check_in_sessions">;
export type CheckInSessionInsert = TablesInsert<"check_in_sessions">;
export type CheckInSessionUpdate = TablesUpdate<"check_in_sessions">;

export type CheckInRow = Tables<"check_ins">;
export type CheckInInsert = TablesInsert<"check_ins">;
export type CheckInUpdate = TablesUpdate<"check_ins">;

export type ApplicationReviewNoteRow = Tables<"application_review_notes">;
export type ApplicationReviewNoteInsert =
  TablesInsert<"application_review_notes">;

export type EventApplicationStatus = Enums<"event_application_status">;
/** Every status but `draft`: what admins review and decide. */
export type SubmittedApplicationStatus = Exclude<EventApplicationStatus, "draft">;
/** An application its applicant has submitted. */
export type SubmittedApplicationRow = EventApplicationRow & {
  status: SubmittedApplicationStatus;
};
export type EventLocationType = Enums<"event_location_type">;
export type EventLinkType = Enums<"event_link_type">;
export type EventLinkVisibility = Enums<"event_link_visibility">;
export type ResponseType = Enums<"response_type">;
export type UserType = Enums<"user_type">;
export type RoleAccess = Enums<"role_access_enum">;
export type StudentStatus = Enums<"student_status">;
export type UniversityYear = Enums<"uni_year">;

export type EventAgendaDayRow = Tables<"event_agenda_days">;
export type EventAgendaDayInsert = TablesInsert<"event_agenda_days">;
export type EventAgendaDayUpdate = TablesUpdate<"event_agenda_days">;

export type EventAgendaItemRow = Tables<"event_agenda_items">;
export type EventAgendaItemInsert = TablesInsert<"event_agenda_items">;
export type EventAgendaItemUpdate = TablesUpdate<"event_agenda_items">;

export const ResponseType = {
  short_text: "short_text",
  long_text: "long_text",
  checkbox: "checkbox",
  multiple_choice: "multiple_choice",
  dropdown: "dropdown",
  file_upload: "file_upload",
} as const satisfies Record<ResponseType, ResponseType>;

export type EventDateLocationSettingsRow = Tables<"event_date_location_settings">;
