import {
  ResponseType,
  type EventRow,
  type ResponseType as ResponseTypeValue,
} from "@/lib/supabase/models";

export { ResponseType };

/**
 * An application question in the admin builder. `id` is the saved question's,
 * absent until the first save; saving sends it back so the question, and the
 * answers to it, keep that id.
 */
export interface ApplicationQuestionTemplate {
  id?: string;
  question: string;
  description: string;
  response: ResponseTypeValue;
  is_required: boolean;
  max_char_limit: number | "";
  response_options: string[];
}

/** Display-ready event details for a ticket; build one with `toTicketEvent`. */
export interface TicketEvent {
  name: string;
  date: string | null;
  time: string | null;
  location: string | null;
}

/**
 * The badge on a student's event card and event page, naming their event
 * state (docs/event-states.md). `date` completes "Opens" and "Register by".
 * Build one with `eventBadgeFor`.
 */
export interface EventBadge {
  status:
    | "opens"
    | "registration_open"
    | "full"
    | "registration_closed"
    | "going"
    | "checked_in"
    | "past"
    | "applications_open"
    | "draft"
    | "pending"
    | "waitlisted"
    | "register_by"
    | "not_selected"
    | "applications_closed";
  date?: string;
}

export interface EventGroup {
  key: string;
  label: string;
  events: EventRow[];
}
