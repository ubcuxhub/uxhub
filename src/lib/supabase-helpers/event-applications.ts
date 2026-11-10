import { listApplicationFiles, removeApplicationFiles } from "./application-files";
import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
  EventApplicationResponseInsert,
  EventApplicationRow,
  EventApplicationUpdate,
  SubmittedApplicationRow,
  SubmittedApplicationStatus,
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

/** Narrows an application to one its applicant has submitted. */
export function isSubmittedApplication(
  application: EventApplicationRow
): application is SubmittedApplicationRow {
  return application.status !== "draft";
}

/** One applicant on an event's review list. */
export interface ApplicationSummary {
  applicationId: string;
  userId: string;
  name: string;
  email: string;
  /** Their major, else faculty, for a second line under the name. */
  program: string | null;
  /** When it was submitted. */
  appliedAt: string;
  status: SubmittedApplicationStatus;
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
 * A user's applications to many events in one round trip, keyed by event id.
 * An event the user hasn't applied to is absent.
 */
export async function fetchUserEventApplications(
  supabase: DbClient,
  userId: string,
  eventIds: string[]
): Promise<Map<string, EventApplicationRow>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .select("*")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (error) throw error;
  return new Map((data ?? []).map((application) => [application.event_id, application]));
}

/**
 * An event's submitted applications, most recently submitted first, with who
 * applied and whether they hold a ticket, which an accepted application needs
 * to show as Registered. Drafts are the applicant's alone and never listed;
 * RLS hides them from admins too, but a service-role caller would see them.
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
      .neq("status", "draft")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from(TABLES.eventTickets)
      .select("user_id")
      .eq("event_id", eventId),
  ]);

  if (applicationsResult.error) throw applicationsResult.error;
  if (ticketsResult.error) throw ticketsResult.error;

  const applications = (applicationsResult.data ?? []).filter(
    isSubmittedApplication
  );
  if (applications.length === 0) return [];

  const ticketHolders = new Set(
    (ticketsResult.data ?? []).map((ticket) => ticket.user_id)
  );
  const { data: users, error: usersError } = await supabase
    .from(TABLES.userInfo)
    .select("id, first_name, last_name, email, major, faculty")
    .in(
      "id",
      applications.map((application) => application.user_id)
    );
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((user) => [user.id, user]));

  return applications.map((application) => {
    const user = userById.get(application.user_id);
    return {
      applicationId: application.id,
      userId: application.user_id,
      name: user ? formatUserName(user) : "Unknown User",
      email: user?.email ?? "",
      program: user?.major || user?.faculty || null,
      appliedAt: application.submitted_at ?? application.created_at,
      status: application.status,
      offerExpiresAt: application.offer_expires_at,
      hasTicket: ticketHolders.has(application.user_id),
    };
  });
}

/**
 * Starts the caller's application to an event as a draft. RLS allows it only
 * for themself, on an event that requires one, while its registration is
 * open. If they already have one (a double submit, say), that one is returned.
 */
export async function createDraftApplication(
  supabase: DbClient,
  eventId: string,
  userInfoId: string
): Promise<EventApplicationRow> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .insert({ event_id: eventId, user_id: userInfoId, status: "draft" })
    .select()
    .single();

  if (error?.code === "23505") {
    const existing = await fetchUserEventApplication(supabase, eventId, userInfoId);
    if (existing) return existing;
  }
  if (error) throw error;
  return data;
}

/**
 * Deletes the caller's draft and the files uploaded for it. Files go first,
 * while Storage still sees a draft; responses cascade with the row. Returns
 * false when there was no draft to delete (already submitted, or gone).
 */
export async function deleteDraftApplication(
  supabase: DbClient,
  input: { applicationId: string; userInfoId: string }
): Promise<boolean> {
  const files = await listApplicationFiles(supabase, input);
  await removeApplicationFiles(supabase, files);

  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .delete()
    .eq("id", input.applicationId)
    .eq("status", "draft")
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Why `submitEventApplication` did not submit, or `SUBMITTED`. */
export type SubmitApplicationStatus =
  | "SUBMITTED"
  | "INCOMPLETE"
  | "NOT_FOUND"
  | "NOT_DRAFT"
  | "NOT_ACCEPTING_APPLICATIONS"
  | "REGISTRATION_NOT_OPEN"
  | "REGISTRATION_CLOSED";

export interface SubmitApplicationResult {
  status: SubmitApplicationStatus;
  /**
   * With `INCOMPLETE`, the questions to fix, in question order: a required
   * one left empty, text over its limit, or a file answer that is not an
   * upload of this applicant's for that question. Empty otherwise.
   */
  missingQuestionIds: string[];
}

/**
 * Submits the caller's draft through `submit_event_application`, which checks
 * ownership, the registration window and the answers, then moves it to
 * submitted. Save the answers first: it reads what is stored.
 */
export async function submitEventApplication(
  supabase: DbClient,
  applicationId: string
): Promise<SubmitApplicationResult> {
  const { data, error } = await supabase.rpc("submit_event_application", {
    p_application_id: applicationId,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("submit_event_application returned no result.");

  return {
    status: row.status as SubmitApplicationStatus,
    missingQuestionIds: row.missing_question_ids ?? [],
  };
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

/**
 * Writes an application's answers, replacing earlier ones to the same
 * question. RLS allows it only on the caller's own draft, and only for
 * questions of its event. Encode checkbox answers with
 * `encodeCheckboxResponse` (`@/lib/application-response`).
 */
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
 * Fetches an application's responses, joined with their questions. Members
 * read their own; admins read those of submitted applications. The
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

/** How many of an event's applications are in each review state. */
export type EventApplicationStatusCounts = Record<
  SubmittedApplicationStatus,
  number
> & { total: number };

// Drafts are the applicant's alone, so they are never counted.
const APPLICATION_STATUSES = ["submitted", "accepted", "rejected", "waitlisted"] as const satisfies readonly SubmittedApplicationStatus[];

/**
 * Counts an event's applications by status, for the admin overview. Every
 * status is present, at zero when none are in it. Exact counts from the
 * database, one per status, so no row limit applies. Under RLS a caller who
 * can't see the applications gets zeros, so pass an admin's client.
 */
export async function fetchEventApplicationStatusCounts(
  supabase: DbClient,
  eventId: string
): Promise<EventApplicationStatusCounts> {
  const results = await Promise.all(
    APPLICATION_STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .from(TABLES.eventApplications)
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", status);
      if (error) throw error;
      return [status, count ?? 0] as const;
    })
  );

  const counts = { total: 0 } as EventApplicationStatusCounts;
  for (const [status, count] of results) {
    counts[status] = count;
    counts.total += count;
  }
  return counts;
}
