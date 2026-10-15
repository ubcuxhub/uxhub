import {
  ResponseType,
  type ApplicationStatus,
  type ResponseType as ResponseTypeValue,
} from "@/lib/supabase/models";

export { ResponseType };

export interface ApplicationQuestionTemplate {
  question: string;
  description: string;
  response: ResponseTypeValue;
  is_required: boolean;
  max_char_limit: number | "";
  response_options: string[];
  restrict_file_types: boolean;
  allowed_file_types: string[];
  max_file_size_bytes: number | "";
}

/** Display-ready event details for a ticket; build one with `toTicketEvent`. */
export interface TicketEvent {
  name: string;
  date: string | null;
  time: string | null;
  location: string | null;
}

export interface TicketHolder {
  name: string;
  email?: string | null;
}

/**
 * The student-facing event badge from docs/event-states.md. A code is shown
 * for `going` and `checked_in`. There is no cancelled state.
 */
export type TicketBadge =
  | "under_review"
  | "waitlisted"
  | "register_by"
  | "offer_expired"
  | "not_selected"
  | "going"
  | "checked_in";

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}
