import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
  EventApplicationResponseRow,
  EventApplicationResponseInsert,
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
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Returns question ids for an event, ordered by creation time. */
export async function fetchApplicationQuestionIds(
  supabase: DbClient,
  eventId: string
): Promise<Pick<EventApplicationQuestionRow, "id">[]> {
  const { data, error } = await supabase
    .from(TABLES.eventApplicationQuestions)
    .select("id")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

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

/** Returns the question ids that already have a response for a registration. */
export async function fetchAnsweredQuestionIds(
  supabase: DbClient,
  registrationId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLES.eventApplicationResponses)
    .select("event_application_question_id")
    .eq("event_registration_id", registrationId);

  // PGRST116 means no rows, which is fine for a registration without responses.
  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data ?? []).map(
    (row: Pick<EventApplicationResponseRow, "event_application_question_id">) =>
      row.event_application_question_id
  );
}

export async function updateApplicationResponse(
  supabase: DbClient,
  registrationId: string,
  questionId: string,
  response: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.eventApplicationResponses)
    .update({ response })
    .eq("event_registration_id", registrationId)
    .eq("event_application_question_id", questionId);

  if (error) throw error;
}

export async function insertApplicationResponses(
  supabase: DbClient,
  responses: EventApplicationResponseInsert[]
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLES.eventApplicationResponses)
    .insert(responses)
    .select("id, event_registration_id, event_application_question_id");

  if (error) throw error;
  return data?.length ?? 0;
}
