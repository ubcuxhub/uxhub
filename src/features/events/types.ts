import {
  ResponseType,
  type EventRow,
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
 * The student's own badge on their ticket, once they've applied or registered
 * (docs/event-states.md). A code is shown for `going` and `checked_in`. There
 * is no cancelled state.
 */
export type TicketBadge =
  | "under_review"
  | "waitlisted"
  | "register_by"
  | "offer_expired"
  | "not_selected"
  | "going"
  | "checked_in";

/**
 * The badge on a student's event card and event page: their own badge, or the
 * event's availability (see more at docs/event-states.md). `date` completes "Opens" and
 * "Register by". Build one with `eventBadgeFor`.
 */
export interface EventBadge {
  status:
    | "going"
    | "checked_in"
    | "under_review"
    | "waitlisted"
    | "register_by"
    | "offer_expired"
    | "not_selected"
    | "opens"
    | "registration_open"
    | "full"
    | "registration_closed"
    | "past";
  date?: string;
}

export interface EventGroup {
  key: string;
  label: string;
  events: EventRow[];
}
