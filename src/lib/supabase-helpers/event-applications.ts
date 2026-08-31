import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
} from "@/types/models";

export interface ApplicationResponseWithQuestion {
  id: string;
  event_registration_id: string;
  event_application_question_id: string;
  response: string;
  created_at: string;
  event_application_questions: {
    id: string;
    question: string;
    description: string | null;
    is_required: boolean;
    response_type: string;
    max_char_limit: number | null;
    response_options: string[] | null;
  } | null;
}

export async function fetchApplicationQuestions(
  supabase: DbClient,
  eventId: string
): Promise<EventApplicationQuestionRow[]> {
  const { data, error } = await supabase
    .from(TABLES.eventApplicationQuestions)
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertApplicationQuestions(
  supabase: DbClient,
  questions: EventApplicationQuestionInsert[]
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.eventApplicationQuestions)
    .insert(questions);

  if (error) throw error;
}

export async function deleteApplicationQuestionsForEvent(
  supabase: DbClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.eventApplicationQuestions)
    .delete()
    .eq("event_id", eventId);

  if (error) throw error;
}

/**
 * Fetches application responses for a registration, joined with their
 * questions. The embedded `event_application_questions (...)` selection pins
 * the relationship between responses and questions.
 */
export async function fetchApplicationResponsesForRegistration(
  supabase: DbClient,
  registrationId: string
): Promise<ApplicationResponseWithQuestion[]> {
  const { data, error } = await supabase
    .from(TABLES.eventApplicationResponses)
    .select(
      `
      *,
      event_application_questions (
        id,
        question,
        description,
        is_required,
        response_type,
        max_char_limit,
        response_options
      )
    `
    )
    .eq("event_registration_id", registrationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationResponseWithQuestion[];
}
