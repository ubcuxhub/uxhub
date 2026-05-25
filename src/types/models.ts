import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

export type EventRow = Tables<"events">;
export type EventInsert = TablesInsert<"events">;
export type EventUpdate = TablesUpdate<"events">;

export type UserInfoRow = Tables<"user_info">;
export type UserInfoInsert = TablesInsert<"user_info">;
export type UserInfoUpdate = TablesUpdate<"user_info">;

export type MembershipTypeRow = Tables<"membership_types">;
export type MembershipTypeInsert = TablesInsert<"membership_types">;
export type MembershipTypeUpdate = TablesUpdate<"membership_types">;

export type EventRegistrationRow = Tables<"event_registrations">;
export type EventRegistrationInsert = TablesInsert<"event_registrations">;
export type EventRegistrationUpdate = TablesUpdate<"event_registrations">;

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

export type ApplicationStatus = Enums<"application_status">;
export type ResponseType = Enums<"response_type">;
export type UserType = Enums<"user_type">;
export type RoleAccess = Enums<"role_access_enum">;
export type UniversityYear = Enums<"uni_year">;

export const ResponseType = {
  text: "text",
  single_select: "single_select",
  multi_select: "multi_select",
} as const satisfies Record<ResponseType, ResponseType>;
