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
 * `valid` shows a scannable code, `checked_in` keeps it scannable for later
 * sessions, and `cancelled` (refunded or released) hides it.
 */
export type TicketStatus = "valid" | "checked_in" | "cancelled";

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}
