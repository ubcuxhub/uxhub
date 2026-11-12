"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import {
  createDraftApplication,
  deleteDraftApplication,
  fetchApplicationQuestions,
  fetchUserEventApplication,
  submitEventApplication,
  upsertApplicationResponses,
  type SubmitApplicationStatus,
} from "@/lib/supabase-helpers/event-applications";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

import {
  applicationWindow,
  encodeAnswer,
  isOwnFilePath,
  parseAnswers,
  validateAnswer,
  validateAnswers,
  type AnswerErrors,
  type ApplicationAnswers,
  type ApplicationQuestion,
} from "./lib/application-form";

/**
 * Why an action stopped. The refusals (`not_accepting`, `not_open`, `closed`,
 * `submitted`) won't change on a retry, so autosave stops on them; `invalid`
 * needs the member to change an answer; `failed` is worth retrying.
 */
export type ApplicationFailureReason =
  | "not_accepting"
  | "not_open"
  | "closed"
  | "submitted"
  | "invalid"
  | "failed";

type Refusal = Exclude<ApplicationFailureReason, "invalid" | "failed">;

export type ApplicationActionResult =
  | { ok: true; applicationId: string }
  | {
      ok: false;
      error: string;
      reason?: ApplicationFailureReason;
      /** Per-question messages, keyed by question id. */
      fieldErrors?: AnswerErrors;
      /** Whether the answers were saved as a draft before it stopped. */
      saved?: boolean;
      /** Set when the draft exists, so the form can offer Delete. */
      applicationId?: string;
    };

export type StartDraftResult =
  | { ok: true; applicationId: string; userInfoId: string }
  | { ok: false; error: string; reason: Refusal };

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Context {
  user: UserInfoRow;
  supabase: Supabase;
  event: EventRow;
  questions: ApplicationQuestion[];
}

const MESSAGES = {
  notAccepting: "This event doesn't take applications.",
  notOpen: "Applications for this event aren't open yet.",
  closed: "Applications for this event have closed.",
  submitted: "You've already submitted this application.",
  unreadable: "Your answers couldn't be read. Reload the page and try again.",
  fix: "Fix the questions marked in red, then try again.",
  saveFailed: "Your answers couldn't be saved. Try again.",
} as const;

const REFUSAL_MESSAGE: Record<Refusal, string> = {
  not_accepting: MESSAGES.notAccepting,
  not_open: MESSAGES.notOpen,
  closed: MESSAGES.closed,
  submitted: MESSAGES.submitted,
};

const refuse = (reason: Refusal) =>
  ({ ok: false, error: REFUSAL_MESSAGE[reason], reason }) as const;

function pathsFor(slug: string | null) {
  return slug ? [`/portal/events/${slug}`, `/portal/events/${slug}/apply`] : [];
}

/**
 * The signed-in member, their client, the event and its questions, or why the
 * event can't take their application. Authentication stays outside any catch:
 * `requireAuth` redirects by throwing.
 */
async function loadContext(
  eventId: unknown
): Promise<{ ok: true; context: Context } | ReturnType<typeof refuse>> {
  const user = await requireAuth();
  if (typeof eventId !== "string" || !eventId) return refuse("not_accepting");
  const supabase = await createClient();
  const event = await fetchEventById(supabase, eventId);
  if (!event?.requires_application) return refuse("not_accepting");
  const questions = await fetchApplicationQuestions(supabase, event.id);
  return { ok: true, context: { user, supabase, event, questions } };
}

/**
 * The member's draft, started now if they have none. Outside the window a
 * draft is read-only, as the page shows it: RLS would still take the write,
 * but the draft could never be submitted.
 */
async function ensureDraft(
  context: Context
): Promise<{ ok: true; applicationId: string } | ReturnType<typeof refuse>> {
  const { supabase, event, user } = context;
  const existing = await fetchUserEventApplication(supabase, event.id, user.id);
  if (existing && existing.status !== "draft") return refuse("submitted");

  const state = applicationWindow(event);
  if (state !== "open") return refuse(state);
  if (existing) return { ok: true, applicationId: existing.id };

  try {
    const draft = await createDraftApplication(supabase, event.id, user.id);
    if (draft.status !== "draft") return refuse("submitted");
    return { ok: true, applicationId: draft.id };
  } catch (error) {
    // RLS refuses the insert when the window shuts between the check and now.
    log.warn("application.draft_start_refused", { eventId: event.id, ...errorFields(error) });
    return refuse("closed");
  }
}

/**
 * Checks and writes the answers given (only those keys) to the member's draft,
 * starting it if needed.
 */
async function saveAnswers(
  context: Context,
  input: unknown
): Promise<ApplicationActionResult & { answers?: ApplicationAnswers }> {
  const answers = parseAnswers(context.questions, input);
  if (!answers) return { ok: false, error: MESSAGES.unreadable, reason: "invalid" };

  const given = context.questions.filter((question) => question.id in answers);
  const fieldErrors = validateAnswers(given, answers, "draft");
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: MESSAGES.fix, reason: "invalid", fieldErrors };
  }

  const draft = await ensureDraft(context);
  if (!draft.ok) return draft;

  for (const question of given) {
    const value = answers[question.id];
    if (
      question.response_type === "file_upload" &&
      typeof value === "string" &&
      value !== "" &&
      !isOwnFilePath(value, {
        userInfoId: context.user.id,
        applicationId: draft.applicationId,
        questionId: question.id,
      })
    ) {
      fieldErrors[question.id] = "Upload the file again.";
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: MESSAGES.fix,
      reason: "invalid",
      fieldErrors,
      applicationId: draft.applicationId,
    };
  }

  try {
    await upsertApplicationResponses(
      context.supabase,
      given.map((question) => ({
        application_id: draft.applicationId,
        event_application_question_id: question.id,
        response: encodeAnswer(question, answers[question.id]),
      }))
    );
  } catch (error) {
    log.error("application.draft_save_failed", {
      applicationId: draft.applicationId,
      ...errorFields(error),
    });
    return {
      ok: false,
      error: MESSAGES.saveFailed,
      reason: "failed",
      applicationId: draft.applicationId,
    };
  }

  return { ok: true, applicationId: draft.applicationId, answers };
}

/**
 * Saves answers to the member's draft of `eventId`'s application, creating the
 * draft on the first save. `answers` is keyed by question id; only the
 * questions it names are written, so the file field can save its one answer.
 */
export async function saveApplicationDraft(
  eventId: string,
  answers: ApplicationAnswers
): Promise<ApplicationActionResult> {
  const loaded = await loadContext(eventId);
  if (!loaded.ok) return loaded;

  const saved = await saveAnswers(loaded.context, answers);
  if (!saved.ok) {
    if (saved.reason && saved.reason !== "invalid" && saved.reason !== "failed") {
      // Expected: the window closed or the draft was submitted (in another
      // tab, say) while the form was open. Autosave stops on it.
      log.warn("application.draft_save_refused", {
        eventId: loaded.context.event.id,
        reason: saved.reason,
      });
    }
    return saved;
  }
  for (const path of pathsFor(loaded.context.event.slug)) revalidatePath(path);
  return { ok: true, applicationId: saved.applicationId };
}

/**
 * Starts the member's draft (if they have none) so the browser can upload a
 * file under it, and returns the ids the storage path needs.
 */
export async function startApplicationDraft(eventId: string): Promise<StartDraftResult> {
  const loaded = await loadContext(eventId);
  if (!loaded.ok) return loaded;

  const draft = await ensureDraft(loaded.context);
  if (!draft.ok) return draft;
  return { ok: true, applicationId: draft.applicationId, userInfoId: loaded.context.user.id };
}

const SUBMIT_REFUSALS: Partial<Record<SubmitApplicationStatus, string>> = {
  NOT_DRAFT: MESSAGES.submitted,
  REGISTRATION_NOT_OPEN: MESSAGES.notOpen,
  REGISTRATION_CLOSED: MESSAGES.closed,
  NOT_ACCEPTING_APPLICATIONS: MESSAGES.notAccepting,
};

/**
 * Saves the answers, then submits the draft. Unanswered or invalid questions
 * come back as `fieldErrors`, with the answers still saved as a draft.
 */
export async function submitApplication(
  eventId: string,
  answers: ApplicationAnswers
): Promise<ApplicationActionResult> {
  const loaded = await loadContext(eventId);
  if (!loaded.ok) return loaded;
  const { context } = loaded;

  const saved = await saveAnswers(context, answers);
  if (!saved.ok) return saved;
  const applicationId = saved.applicationId;
  const savedAnswers = saved.answers ?? {};
  const revalidate = () => {
    for (const path of pathsFor(context.event.slug)) revalidatePath(path);
  };

  const missing = validateAnswers(context.questions, savedAnswers, "submit");
  if (Object.keys(missing).length > 0) {
    revalidate();
    return { ok: false, error: MESSAGES.fix, fieldErrors: missing, saved: true, applicationId };
  }

  let result: Awaited<ReturnType<typeof submitEventApplication>>;
  try {
    result = await submitEventApplication(context.supabase, applicationId);
  } catch (error) {
    log.error("application.submit_failed", { applicationId, ...errorFields(error) });
    return {
      ok: false,
      error: "Your application couldn't be submitted. Try again.",
      saved: true,
      applicationId,
    };
  }

  if (result.status === "SUBMITTED") {
    log.info("application.submitted", { applicationId });
    revalidate();
    return { ok: true, applicationId };
  }

  log.warn("application.submit_refused", { applicationId, status: result.status });
  if (result.status === "INCOMPLETE") {
    const fieldErrors: AnswerErrors = {};
    for (const questionId of result.missingQuestionIds) {
      const question = context.questions.find((candidate) => candidate.id === questionId);
      if (!question) continue;
      fieldErrors[questionId] =
        validateAnswer(question, savedAnswers[questionId], "submit") ??
        (question.response_type === "file_upload"
          ? "Upload the file again."
          : "Check this answer.");
    }
    revalidate();
    return { ok: false, error: MESSAGES.fix, fieldErrors, saved: true, applicationId };
  }

  revalidate();
  return {
    ok: false,
    error: SUBMIT_REFUSALS[result.status] ?? "This application can't be submitted. Reload the page and try again.",
    saved: true,
    applicationId,
  };
}

/** Deletes the member's draft, its answers and its files. */
export async function deleteApplication(
  applicationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth();
  if (typeof applicationId !== "string" || !applicationId) {
    return { ok: false, error: "This application can't be deleted." };
  }
  const supabase = await createClient();

  try {
    const deleted = await deleteDraftApplication(supabase, {
      applicationId,
      userInfoId: user.id,
    });
    if (!deleted) {
      log.warn("application.delete_refused", { applicationId });
      return {
        ok: false,
        error: "This application can't be deleted. Submitted applications are kept.",
      };
    }
  } catch (error) {
    log.error("application.delete_failed", { applicationId, ...errorFields(error) });
    return { ok: false, error: "Your application couldn't be deleted. Try again." };
  }

  log.info("application.draft_deleted", { applicationId });
  revalidatePath("/portal/events/[event]", "page");
  revalidatePath("/portal/events/[event]/apply", "page");
  return { ok: true };
}
