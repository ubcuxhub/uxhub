import type { DbClient } from "./types";
import { TABLES } from "./tables";
import { fetchUserInfoContactsByIds } from "./users";
import type {
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
  EventApplicationResponseInsert,
  EventApplicationRow,
  EventApplicationUpdate,
} from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";

export interface ApplicationResponseWithQuestion {
  id: string;
  application_id: string;
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

/** One applicant on an event's review list. */
export interface ApplicationSummary {
  applicationId: string;
  userId: string;
  name: string;
  email: string;
  appliedAt: string;
  status: EventApplicationRow["status"];
  offerExpiresAt: string | null;
  hasTicket: boolean;
}

export async function fetchEventApplicationById(
  supabase: DbClient,
  applicationId: string
): Promise<EventApplicationRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchUserEventApplication(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<EventApplicationRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * An event's applications, newest first, with who applied and whether they
 * hold a ticket, which an accepted application needs to show as Registered.
 */
export async function fetchEventApplicationSummaries(
  supabase: DbClient,
  eventId: string
): Promise<ApplicationSummary[]> {
  const [applicationsResult, ticketsResult] = await Promise.all([
    supabase
      .from(TABLES.eventApplications)
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from(TABLES.eventTickets)
      .select("user_id")
      .eq("event_id", eventId),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (ticketsResult.error) throw ticketsResult.error;

  const applications = applicationsResult.data ?? [];
  if (applications.length === 0) return [];

  const ticketHolders = new Set(
    (ticketsResult.data ?? []).map((ticket) => ticket.user_id)
  );
  const users = await fetchUserInfoContactsByIds(
    supabase,
    applications.map((application) => application.user_id)
  );
  const userById = new Map(users.map((user) => [user.id, user]));

  return applications.map((application) => {
    const user = userById.get(application.user_id);
    return {
      applicationId: application.id,
      userId: application.user_id,
      name: user ? formatUserName(user) : "Unknown User",
      email: user?.email ?? "",
      appliedAt: application.created_at,
      status: application.status,
      offerExpiresAt: application.offer_expires_at,
      hasTicket: ticketHolders.has(application.user_id),
    };
  });
}

/**
 * Submits the caller's application. RLS allows it only for themself, on an
 * event that requires one, while its registration is open.
 */
export async function insertEventApplication(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<EventApplicationRow> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .insert({ event_id: eventId, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Records an admin's decision. The database enforces the allowed moves. */
export async function updateEventApplication(
  supabase: DbClient,
  applicationId: string,
  payload: Pick<EventApplicationUpdate, "status" | "offer_expires_at">
): Promise<EventApplicationRow> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .update(payload)
    .eq("id", applicationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Writes an application's answers, replacing earlier ones to the same question. */
export async function upsertApplicationResponses(
  supabase: DbClient,
  responses: EventApplicationResponseInsert[]
): Promise<void> {
  if (responses.length === 0) return;

  const { error } = await supabase
    .from(TABLES.eventApplicationResponses)
    .upsert(responses, {
      onConflict: "event_application_question_id,application_id",
    });

  if (error) throw error;
}

/**
 * Fetches an application's responses, joined with their questions. The
 * embedded `event_application_questions (...)` selection pins the
 * relationship between responses and questions.
 */
export async function fetchApplicationResponses(
  supabase: DbClient,
  applicationId: string
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
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationResponseWithQuestion[];
}
