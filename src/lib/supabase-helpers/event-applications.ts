import { hasActiveMembership } from "@/features/memberships/lib/expiry";

import { fetchMembershipTermEndsAt } from "./app-settings";
import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type {
  EventApplicationQuestionInsert,
  EventApplicationQuestionRow,
  EventApplicationResponseInsert,
  EventApplicationRow,
  StudentStatus,
  SubmittedApplicationRow,
  SubmittedApplicationStatus,
  UniversityYear,
  UserInfoRow,
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
  year: UniversityYear | null;
  studentStatus: StudentStatus | null;
  /**
   * Their membership tier's stored name (`explorer`, `nonUbc`) while it is
   * active, else null: a lapsed member reads as a non-member.
   */
  membership: string | null;
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

/**
 * An applicant's own application, as `get_my_event_applications` shows it to
 * them. Before the event's decisions are released (docs/event-states.md,
 * "Decision release") a decided application reads as `submitted`, with no
 * `offer_expires_at` and no `updated_at`. `decisions_release_at` is the
 * event's "Release decisions on", null when none is set.
 */
export type ApplicantApplicationRow = Pick<
  EventApplicationRow,
  "id" | "event_id" | "user_id" | "status" | "offer_expires_at" | "submitted_at" | "created_at"
> & {
  updated_at: string | null;
  decisions_release_at: string | null;
};

/**
 * The caller's applications to these events, through
 * `get_my_event_applications`, which only ever returns the caller's own
 * (`userId` must be theirs: a service-role client sees none). Keyed by event id.
 */
async function fetchOwnApplications(
  supabase: DbClient,
  userId: string,
  eventIds: string[]
): Promise<Map<string, ApplicantApplicationRow>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("get_my_event_applications", {
    p_event_ids: eventIds,
  });

  if (error) throw error;
  return new Map(
    (data ?? [])
      .filter((application) => application.user_id === userId)
      .map((application) => [application.event_id, application])
  );
}

/** The caller's application to an event, as they may see it, or null. */
export async function fetchUserEventApplication(
  supabase: DbClient,
  eventId: string,
  userId: string
): Promise<ApplicantApplicationRow | null> {
  const applications = await fetchOwnApplications(supabase, userId, [eventId]);
  return applications.get(eventId) ?? null;
}

/**
 * The caller's applications to many events in one round trip, keyed by event
 * id, as they may see them. An event they haven't applied to is absent.
 */
export async function fetchUserEventApplications(
  supabase: DbClient,
  userId: string,
  eventIds: string[]
): Promise<Map<string, ApplicantApplicationRow>> {
  return fetchOwnApplications(supabase, userId, eventIds);
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
  const [usersResult, termEndsAt] = await Promise.all([
    supabase
      .from(TABLES.userInfo)
      .select(
        "id, first_name, last_name, email, major, faculty, year, student_status, membership_type_id, membership_expires_at, membership_types!membership_type_id(name)"
      )
      .in(
        "id",
        applications.map((application) => application.user_id)
      ),
    fetchMembershipTermEndsAt(supabase),
  ]);
  if (usersResult.error) throw usersResult.error;
  const userById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));

  return applications.map((application) => {
    const user = userById.get(application.user_id);
    return {
      applicationId: application.id,
      userId: application.user_id,
      name: user ? formatUserName(user) : "Unknown User",
      email: user?.email ?? "",
      program: user?.major || user?.faculty || null,
      year: user?.year ?? null,
      studentStatus: user?.student_status ?? null,
      membership: user ? activeMembershipName(user, termEndsAt) : null,
      appliedAt: application.submitted_at ?? application.created_at,
      status: application.status,
      offerExpiresAt: application.offer_expires_at,
      hasTicket: ticketHolders.has(application.user_id),
    };
  });
}

/**
 * The tier name of a membership that is still active (its own expiry and the
 * club-wide term end both ahead), else null.
 */
export function activeMembershipName(
  user: Pick<UserInfoRow, "membership_type_id" | "membership_expires_at"> & {
    membership_types?: { name: string } | { name: string }[] | null;
  },
  termEndsAt: string | null
): string | null {
  if (!hasActiveMembership(user, termEndsAt)) return null;
  const tier = Array.isArray(user.membership_types)
    ? user.membership_types[0]
    : user.membership_types;
  return tier?.name ?? null;
}

/**
 * Starts the caller's application to an event as a draft. RLS allows it only
 * for themself, on an event that requires one, while its registration is
 * open. If they already have one (a double submit, say), that one is returned
 * as they may see it: a decision not yet released reads as submitted.
 */
export async function createDraftApplication(
  supabase: DbClient,
  eventId: string,
  userInfoId: string
): Promise<ApplicantApplicationRow> {
  const { data, error } = await supabase
    .from(TABLES.eventApplications)
    .insert({ event_id: eventId, user_id: userInfoId, status: "draft" })
    .select("id, event_id, user_id, status, offer_expires_at, submitted_at, created_at, updated_at")
    .single();

  // A unique violation: they already have one, which their own select may
  // not show before release, so read it the way they may see it.
  if (error?.code === "23505") {
    const existing = await fetchUserEventApplication(supabase, eventId, userInfoId);
    if (existing) return existing;
  }
  if (error) throw error;
  return { ...data, decisions_release_at: null };
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

/** Why `decide_event_application` refused a decision. */
export type ApplicationDecisionFailure =
  | "NOT_FOUND"
  | "NOT_SUBMITTED"
  | "INVALID_DECISION"
  | "DEADLINE_REQUIRED"
  | "DEADLINE_TOO_EARLY"
  | "HAS_TICKET"
  | "NOT_ALLOWED"
  | "OVER_CAPACITY";

/** Seats as they stood when the decision was made. */
export interface DecisionSeats {
  tickets: number;
  heldOffers: number;
  /** `null` when the event has no capacity. */
  capacity: number | null;
}

export type ApplicationDecisionResult = {
  applicationId: string;
  eventId: string | null;
  userId: string | null;
  previousStatus: EventApplicationRow["status"] | null;
  /** The status now: the new one, or the unchanged one on a refusal. */
  status: EventApplicationRow["status"] | null;
  offerExpiresAt: string | null;
  /** The event's "Release decisions on", null when none is set. */
  decisionsReleaseAt: string | null;
  seats: DecisionSeats;
  /** An override accepted past capacity. */
  overCapacity: boolean;
} & ({ ok: true } | { ok: false; reason: ApplicationDecisionFailure });

/**
 * Records an admin's decision through `decide_event_application`, which takes
 * the event lock reservation takes, checks capacity on an accept that would
 * take a seat (unless `allowOverCapacity`), requires a deadline after now and
 * after the release, and enforces the allowed moves. Service role only.
 */
export async function decideEventApplication(
  serviceClient: DbClient,
  input: {
    applicationId: string;
    decision: "accept" | "waitlist" | "reject";
    offerExpiresAt: string | null;
    allowOverCapacity?: boolean;
  }
): Promise<ApplicationDecisionResult> {
  const { data, error } = await serviceClient.rpc("decide_event_application", {
    p_application_id: input.applicationId,
    p_decision: input.decision,
    p_offer_expires_at: input.offerExpiresAt ?? undefined,
    p_allow_over_capacity: input.allowOverCapacity ?? false,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("decide_event_application returned no result.");

  const common = {
    applicationId: row.application_id ?? input.applicationId,
    eventId: row.event_id,
    userId: row.user_id,
    previousStatus: row.previous_status,
    status: row.status,
    offerExpiresAt: row.offer_expires_at,
    decisionsReleaseAt: row.decisions_release_at,
    seats: {
      tickets: row.tickets ?? 0,
      heldOffers: row.held_offers ?? 0,
      capacity: row.max_capacity,
    },
    overCapacity: row.over_capacity ?? false,
  };
  return row.failure_reason
    ? { ...common, ok: false, reason: row.failure_reason as ApplicationDecisionFailure }
    : { ...common, ok: true };
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
