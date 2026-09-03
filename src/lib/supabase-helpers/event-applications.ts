import type { DbClient } from "./types";
import { TABLES } from "./tables";
import {
  fetchUserInfoContactsByIds,
  type UserInfoContact,
} from "./users";
import type { ApplicationWithUserContact } from "@/features/events/types/applicationTypes";
import type {
  ApplicationStatus,
  EventApplicationResponseRow,
  EventApplicationRow,
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
} from "@/types/models";

export interface ApplicationResponseWithQuestion
  extends EventApplicationResponseRow {
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

export type EventApplicationSubmissionResponse = {
  question_id: string;
  response: string;
};

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

export async function fetchEventApplicationsWithUserContacts(
  supabase: DbClient,
  eventId: string
): Promise<ApplicationWithUserContact[]> {
  const { data: applications, error } = await supabase
    .from(TABLES.eventApplications)
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });

  if (error) throw error;
  if (!applications?.length) return [];

  const userIds = Array.from(
    new Set(applications.map((application) => application.user_id))
  );
  const users = await fetchUserInfoContactsByIds(supabase, userIds);
  const usersById = new Map<string, UserInfoContact>(
    users.map((user) => [user.id, user])
  );

  return applications.map((application) => ({
    application,
    user: usersById.get(application.user_id) ?? {
      id: application.user_id,
      name: "Unknown User",
      email: "",
    },
  }));
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
 * Fetches application responses joined with their questions in the configured
 * question order.
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
      event_application_questions!inner (
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
    .eq("event_application_id", applicationId)
    .order("sort_order", {
      ascending: true,
      referencedTable: TABLES.eventApplicationQuestions,
    });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationResponseWithQuestion[];
}

export async function submitEventApplication(
  supabase: DbClient,
  eventId: string,
  responses: EventApplicationSubmissionResponse[]
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_event_application", {
    p_event_id: eventId,
    p_responses: responses,
  });

  if (error) throw error;
  return data;
}

export async function reviewEventApplication(
  supabase: DbClient,
  applicationId: string,
  status: Extract<ApplicationStatus, "accepted" | "rejected">
): Promise<EventApplicationRow> {
  const { data, error } = await supabase.rpc("review_event_application", {
    p_application_id: applicationId,
    p_status: status,
  });

  if (error) throw error;
  if (!data) throw new Error("The application review returned no application.");
  return data;
}

export async function confirmFreeEventAttendance(
  supabase: DbClient,
  applicationId: string
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "confirm_free_event_attendance",
    { p_application_id: applicationId }
  );

  if (error) throw error;
  return data;
}

export async function markEventApplicationNotAttending(
  supabase: DbClient,
  applicationId: string
): Promise<EventApplicationRow> {
  const { data, error } = await supabase.rpc(
    "mark_event_application_not_attending",
    { p_application_id: applicationId }
  );

  if (error) throw error;
  if (!data) {
    throw new Error("The attendance update returned no application.");
  }
  return data;
}
