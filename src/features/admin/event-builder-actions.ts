"use server";

import type { Json } from "@/lib/supabase/database.types";
import { fetchEventMutationResult, eventMutationResult, fetchEventHistoryInfo, fetchEventDeletionBlockers, eventDeletionBlocked } from "@/lib/supabase-helpers/event-mutations";
import { eventContentProblem, type EventContent } from "./lib/event-content";
import { searchMentors, searchSponsors } from "@/lib/supabase-helpers/event-people";
import { isReminderSchedule } from "@/lib/supabase-helpers/event-reminders";
import { agendaEnvelope, parseDateLocationDraft, dateLocationProblem, dateSessions, type EventDateLocationDraft } from "./lib/event-date-location";
import { saveEventDraft, fetchEventDraft, eventImageIsReferenced, recoverEventDraftReceipt } from "@/lib/supabase-helpers/event-drafts";
import { workingDocumentImageUrls, type EventWorkingDocument } from "./lib/event-working-document";
import { parseEventDescription, descriptionText } from "@/lib/event-description";
import { shortOverviewTooLong } from "./lib/event-overview";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { eventSlugError, eventSlugStem, priceError, suggestedEventSlug, uniqueEventSlug, websiteUrlError } from "./lib/event-configuration";
import { createUniqueSlug, slugify } from "@/lib/slug";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adminDeleteEventImageByUrl } from "@/lib/supabase-helpers/admin-server";
import { datetimeLocalToTimestamptz } from "@/lib/date";
import { publishAtProblem, isTimestamptz, builderPublicationProblem, publicationClosingProblem } from "@/features/admin/lib/event-publication";
import { removeApplicationFiles } from "@/lib/supabase-helpers/application-files";
import {
  fetchEventById,
  fetchEventSlugsByPrefix,
} from "@/lib/supabase-helpers/events";
import type {
  ApplicationQuestionInput,
  CheckInSessionInput,
} from "@/features/admin/types";
import type { EventUpdate } from "@/lib/supabase/models";

export interface SavedEventPublication {
  id: string;
  name: string;
  status: "draft" | "active";
  publish_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
}

export interface SaveAdminEventInput {
  operationId?: string;
  expectedRevision?: number;
  /** Checked under the same row lock as the write, including cron activation. */
  expectedPublication?: { status: "draft" | "active"; publish_at: string | null } | null;
  applicationTiming?: { decisions_release_at: string | null; confirmation_deadline: string | null };
  dateLocation?: EventDateLocationDraft | null;
  content?: EventContent;
  dateLocationRevision?: number;
  eventId?: string;
  /**
   * The cover image URL the form was loaded with, used as the precondition for
   * an update. Ignored when creating.
   */
  expectedImageUrl: string | null;
  expectedHeaderImageUrl?: string | null;
  draftId?: string;
  draftRevision?: number;
  event: EventUpdate;
  checkInSessions: CheckInSessionInput[];
  mentorIds: string[];
  sponsorIds: string[];
  applicationQuestions: ApplicationQuestionInput[];
}

/**
 * The saved event's id and the ids of its check-in sessions and application
 * questions, each in the order they were sent, or why the save was refused.
 */
export type SaveAdminEventResult =
  | { revision?: number; pageSlug?: string; id: string; checkInSessionIds: string[]; questionIds: string[]; dateLocationRevision?: number; content?: EventContent; publication?: SavedEventPublication }
  | { error: string };

// Not exported: a "use server" module may only export async functions.
// Raised by save_admin_event_atomically when the cover-image precondition
// fails, and returned to the form as SAVE_CONFLICT_ERROR. Every refusal here is
// returned rather than thrown, since production builds withhold a thrown
// error's message from the client.
const IMAGE_CONFLICT_SENTINEL = "EVENT_IMAGE_CONFLICT";

const SAVE_CONFLICT_ERROR =
  "This event's cover image was changed somewhere else since this page loaded. Reload the page and apply your changes again.";

// The hints save_admin_event_atomically gives a refusal over application
// questions (removing or retyping answered ones, or a stale question id) or
// check-in sessions (removing one with check-ins, or a stale session id). Its
// message is written for the admin, and is returned rather than thrown, since
// production builds withhold a thrown error's message from the client.
const REFUSAL_EVENTS = new Map([
  ["APPLICATION_QUESTIONS_CONFLICT", "admin.event_questions_save_refused"],
  ["CHECK_IN_SESSIONS_CONFLICT", "admin.event_check_in_sessions_save_refused"],
]);

/**
 * Removes a cover image that is no longer referenced by any event.
 *
 * Best-effort on purpose: the database is the source of truth, so a leaked
 * storage object is cheaper than failing a save or delete that already
 * succeeded. No-ops for values that are not storage URLs.
 */
async function discardEventImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return;

  try {
    if (await eventImageIsReferenced(supabaseAdmin, imageUrl)) return;
    await adminDeleteEventImageByUrl(imageUrl);
  } catch (error) {
    log.error("admin.event_image_delete_failed", errorFields(error));
  }
}

/**
 * Removes uploaded application files nothing answers with any more. Best
 * effort, like `discardEventImage`: the save has already committed.
 */
async function discardApplicationFiles(paths: string[]) {
  if (paths.length === 0) return;

  try {
    await removeApplicationFiles(supabaseAdmin, paths);
  } catch (error) {
    log.warn("admin.application_files_delete_failed", errorFields(error));
  }
}

/**
 * Removes a cover image that was uploaded for a save that then failed.
 *
 * Safe to expose to the client even though it takes a URL: it refuses to touch
 * anything an event still references, so a save that actually landed can never
 * lose its image, and `discardEventImage` ignores URLs outside our bucket.
 */
export async function discardUnusedEventImageAction(imageUrl: string) {
  await requireAdmin();

  if (!imageUrl) return;
  if (await eventImageIsReferenced(supabaseAdmin, imageUrl)) return;

  await discardEventImage(imageUrl);
}

export async function saveAdminEventDraftAction(input: { id: string; eventId: string | null; revision: number; document: EventWorkingDocument; eventRevision?: number; operationId?: string }): Promise<{ id: string; eventId?: string; revision: number; pageSlug?: string; eventRevision?: number } | { error: string }> {
  await requireAdmin();
  // Live edits remain local until the deliberate Update action.
  if (input.eventId) {
    const event = await fetchEventById(supabaseAdmin, input.eventId);
    if (!event || event.status !== "draft" || event.publish_at) return { error: "This event was published or scheduled since this page loaded. Reload it to keep editing." };
  }
  const previous = await fetchEventDraft(supabaseAdmin, input.id);
  let saved: Awaited<ReturnType<typeof saveEventDraft>>;
  try {
    saved = await saveEventDraft(supabaseAdmin, input.id, input.eventId, input.revision, input.document, input.eventRevision, input.operationId);
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? error.message : null;
    if (typeof message === "string" && [
      "This page URL is already in use.",
      "The page URL is locked after first publication.",
      "Use a valid, non-reserved page URL of at most 100 characters.",
      "This draft changed in another tab. Reload it before saving again.",
    ].includes(message)) return { error: message };
    throw error;
  }
  if (previous) await Promise.all(workingDocumentImageUrls(previous.document).map(discardEventImage));
  revalidatePath("/admin/events", "layout");
  revalidatePath("/portal/events", "layout");
  revalidatePath("/events", "layout");
  return { id: saved.id, eventId: saved.eventId, revision: saved.revision, pageSlug: saved.document.formState.page_slug, eventRevision: saved.eventRevision };
}

/**
 * The page URL for an event whose admin has not edited it: made from the
 * name and numbered past every URL another event holds (`coffee-chat-1`), so a
 * second event with the same name saves. The event's own URLs don't count as
 * taken, and a URL it already holds is kept, so re-saving or renaming an event
 * never bumps its own URL. A published event's URL is locked, so the one the
 * form sent is left for the database to hold to that lock.
 */
async function automaticPageSlug(eventId: string | null, name: string | null | undefined, sent: string | null | undefined) {
  const current = eventId ? await fetchEventById(supabaseAdmin, eventId) : null;
  if (current?.first_published_at) return sent;
  const base = suggestedEventSlug(name ?? current?.name ?? "") || "event";
  const taken = await fetchEventSlugsByPrefix(supabaseAdmin, eventSlugStem(base), { exceptEventId: eventId });
  return uniqueEventSlug(base, taken, current?.configured_slug);
}

export async function saveAdminEventAction(
  input: SaveAdminEventInput
): Promise<SaveAdminEventResult> {
  await requireAdmin();

  if (input.eventId && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision! < 0)) return { error: "Reload this event before updating; its saved revision is missing." };
  if (input.content) { const problem = eventContentProblem(input.content); if (problem) return { error: problem }; }
  { const problem = publishAtProblem(input.event.status, input.event.publish_at); if (problem) return { error: problem }; }
  if ("agenda_enabled" in input.event && typeof input.event.agenda_enabled !== "boolean") return { error: "Schedule visibility must be on or off." };
  if ("reminder_schedule" in input.event && !isReminderSchedule(input.event.reminder_schedule)) return { error: "Choose when reminder emails go out." };
  const { min_team_size: min, max_team_size: max, team_deadline: deadline } = input.event;
  if ([min, max].some(value => value != null && (!Number.isSafeInteger(value) || value < 1 || value > 2147483647))) return { error: "Team sizes must be positive whole numbers no greater than 2,147,483,647." };
  if (min != null && max != null && min > max) return { error: "Minimum team size cannot exceed maximum team size." };
  if (deadline != null && !isTimestamptz(deadline)) return { error: "Team deadline requires a valid date and time with a timezone." };

  if (input.applicationTiming) {
    const { decisions_release_at: release, confirmation_deadline: confirm } = input.applicationTiming;
    if ([release, confirm].some(value => value !== null && !isTimestamptz(value))) return { error: "Application timing requires a valid date and time with a timezone." };
    if (release && confirm && Date.parse(confirm) <= Date.parse(release)) return { error: "Confirm by must be later than Release decisions on." };
  }
  let datePayload = {};
  if (input.dateLocation) {
    const config = parseDateLocationDraft(input.dateLocation);
    const problem = dateLocationProblem(config);
    if (problem) return { error: problem };
    if (config.version === 2) {
      const envelope = agendaEnvelope(config);
      input = { ...input, event: { ...input.event, starts_at: datetimeLocalToTimestamptz(envelope.starts_at), ends_at: datetimeLocalToTimestamptz(envelope.ends_at) } };
    }
    const sessions = dateSessions(config);
    datePayload = { _date_revision: input.dateLocationRevision ?? 0, _date_location: { ...config, dates: config.version === 2 ? config.dates : config.dates.map((row, index) => ({ ...row, start_time: sessions[index].start_time, end_time: sessions[index].end_time })) } };
  }

  if (shortOverviewTooLong(input.event.short_description) || (input.event.description?.length ?? 0) > 3000) return { error: "Overview exceeds its character limit." };
  if (input.event.description_rich != null) {
    const rich = parseEventDescription(input.event.description_rich);
    if (!rich || descriptionText(rich) !== input.event.description) return { error: "Invalid long overview formatting." };
  }
  if (input.event.configured_slug_edited === false) {
    const configuredSlug = await automaticPageSlug(input.eventId ?? null, input.event.name, input.event.configured_slug);
    input = { ...input, event: { ...input.event, configured_slug: configuredSlug } };
  }
  if (input.event.configured_slug != null) {
    const error = eventSlugError(input.event.configured_slug);
    if (error) return { error };
  }
  if (input.event.configured_marketing_mode === "external") {
    const error = websiteUrlError(input.event.configured_marketing_url ?? "");
    if (error) return { error };
    // Normalize hostnames (including international domains) consistently with
    // URL parsing before the database's protocol/host safety constraint.
    input = { ...input, event: { ...input.event, configured_marketing_url: new URL(input.event.configured_marketing_url!).href } };
  }
  if (input.event.configured_pricing_mode != null) {
    const error = priceError(String(input.event.configured_price ?? ""));
    if (error) return { error };
  }
  const publicationProblem = publicationClosingProblem(input.event) ?? builderPublicationProblem(input);
  if (publicationProblem) return { error: publicationProblem };
  let slug: string | null = null;

  if (!input.eventId) {
    const normalizedBaseSlug = slugify(input.event.name ?? "");
    const baseSlug =
      normalizedBaseSlug === "item" ? "event" : normalizedBaseSlug;
    const existingSlugs = await fetchEventSlugsByPrefix(
      supabaseAdmin,
      baseSlug
    );
    slug = createUniqueSlug(
      input.event.name ?? "event",
      existingSlugs,
      "event"
    );
  }

  // The cover-image precondition is checked inside the same statement that
  // writes the row, so a stale tab cannot overwrite a replacement made
  // elsewhere between this form loading and saving.
  const draftIdentity = input.draftId ?? input.eventId;
  const previousDraft = draftIdentity ? await fetchEventDraft(supabaseAdmin, draftIdentity) : null;
  if (previousDraft) {
    const state = previousDraft.document.formState;
    if (state.content && !input.content) return { error: "Reload saved people and resources before publishing." };
    if (state.date_location && !input.dateLocation) return { error: "Reload saved dates and locations before publishing." };
    if ((state.decisions_release_at || state.confirmation_deadline) && !input.applicationTiming) return { error: "Reload saved application timing before publishing." };
  }
  // The generator omits SQL argument nullability: `(x ?? null)!` still sends
  // null for a new event, a missing draft, or no expected image.
  const { data, error } = await supabaseAdmin.rpc(
    "save_admin_event_builder",
    {
      p_event_id: (input.eventId ?? null)!,
      p_draft_id: (input.draftId ?? null)!,
      p_draft_revision: input.draftRevision ?? 0,
      p_expected_header_image_url: (input.expectedHeaderImageUrl ?? null)!,
      p_event: { ...input.event, ...datePayload, ...(input.operationId ? { _operation_id: input.operationId } : {}), ...(input.expectedRevision !== undefined ? { _expected_revision: input.expectedRevision } : {}), ...(input.expectedPublication ? { _expected_publication: input.expectedPublication } : {}), ...(input.content ? { _content: input.content } : {}), ...(input.applicationTiming ? { _application_timing: input.applicationTiming } : {}) } as unknown as Json,
      p_slug: slug!,
      p_expected_image_url: input.expectedImageUrl!,
      p_check_in_sessions: input.checkInSessions as unknown as Json,
      p_application_questions: input.applicationQuestions,
      p_mentors: input.mentorIds,
      p_sponsors: input.sponsorIds,
    }
  );
  if (error) {
    if (["EVENT_REVISION_CONFLICT", "EVENT_HISTORY_LOCKED"].includes(error.hint ?? "")) return { error: error.message };
    if (error.hint === "EVENT_PUBLICATION_CONFLICT" || error.hint === "EVENT_PUBLICATION_INVALID") return { error: error.message };
    if (error.message.includes(IMAGE_CONFLICT_SENTINEL)) {
      return { error: SAVE_CONFLICT_ERROR };
    }
    const refusal = REFUSAL_EVENTS.get(error.hint);
    if (refusal) {
      log.warn(refusal, { eventId: input.eventId ?? null });
      return { error: error.message };
    }
    const configurationMessages = [
      "This page URL is already in use.",
      "The page URL is locked after first publication.",
      "Pricing is locked because registrations or payments exist.",
    ];
    if (configurationMessages.includes(error.message)) return { error: error.message };
    if (error.code === "23505" && /events_slug|idx_events_slug|event_url_claims/.test(error.message)) return { error: "This page URL is already in use." };
    if (error.code === "23514" && /events_configured_/.test(error.message)) return { error: "Review the marketing destination and pricing before saving." };
    if (error.code === "23514" && /events_(min_team_size|max_team_size|team_size_range)_check/.test(error.message)) return { error: "Team sizes must be positive whole numbers with minimum no greater than maximum." };
    if (error.hint === "EVENT_CONTENT_INVALID") return { error: error.message };
    if (error.hint === "EVENT_SETTINGS_CONFLICT") return { error: error.message };
    throw error;
  }
  const saved = data as {
    id?: string;
    revision?: number;
    check_in_session_ids?: string[];
    question_ids?: string[];
    removed_files?: string[];
    content?: EventContent;
    date_location_revision?: number;
    publication?: SavedEventPublication;
    page_slug?: string;
  } | null;
  if (!saved?.id) throw new Error("The event save returned no event id.");
  if (previousDraft) await Promise.all(workingDocumentImageUrls(previousDraft.document).map(discardEventImage));

  // The save landed, so the image it replaced is unreferenced.
  if (input.eventId && (input.event.image_url ?? null) !== input.expectedImageUrl) {
    await discardEventImage(input.expectedImageUrl);
  }

  if (
    input.eventId &&
    input.event.header_image_url !== undefined &&
    (input.event.header_image_url ?? null) !== (input.expectedHeaderImageUrl ?? null)
  ) {
    await discardEventImage(input.expectedHeaderImageUrl);
  }

  // Files answering questions the save removed, from drafts only: a question
  // with submitted answers cannot be removed.
  await discardApplicationFiles(saved.removed_files ?? []);

  // The list, and the event's overview (page and drawer) and builder below it.
  revalidatePath("/admin/events", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/portal/events", "layout");
  return {
    id: saved.id,
    revision: saved.revision,
    pageSlug: saved.page_slug ?? input.event.configured_slug ?? slug ?? undefined,
    publication: saved.publication,
    content: saved.content,
    dateLocationRevision: saved.date_location_revision,
    checkInSessionIds: saved.check_in_session_ids ?? [],
    questionIds: saved.question_ids ?? [],
  };
}

/** The database's refusal to delete an event that would affect members or
 * live purchases (`delete_event_before_safe_mutations`). */
const EVENT_DELETE_PROTECTED = "EVENT_DELETE_PROTECTED";
const EVENT_DELETE_PROTECTED_MESSAGE = "This event can’t be deleted because members are registered, hold offers, or have payments that aren’t failed, canceled or refunded. Nothing has been deleted.";

/**
 * Deletes an event and its images and application files. `operationId` is
 * the receipt that lets a retry after a lost response find the delete that
 * already happened.
 */
export async function deleteAdminEventAction(eventId: string, operationId: string): Promise<{ error: string } | undefined> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin.rpc("delete_admin_event_safely", { p_event_id: eventId, p_operation_id: operationId });
  if (error?.hint === EVENT_DELETE_PROTECTED) {
    log.warn("admin.event_delete_refused", { eventId });
    return { error: EVENT_DELETE_PROTECTED_MESSAGE };
  }
  if (error) throw error;
  const assets = data as { images?: string[]; files?: string[] } | null;
  await Promise.all((assets?.images ?? []).map(discardEventImage));
  await discardApplicationFiles(assets?.files ?? []);

  revalidatePath("/admin/events", "layout");
}

export async function searchEventDirectoryAction(kind: "people" | "sponsors", query: string) {
  await requireAdmin();
  if (typeof query !== "string" || query.length > 200) throw new Error("Invalid directory query.");
  const client = await createClient();
  return kind === "sponsors" ? { sponsors: await searchSponsors(client, query) } : { people: await searchMentors(client, query) };
}

/** Recover the committed response before deciding whether to replay a request. */
export async function recoverAdminEventMutationAction(id: string): Promise<SaveAdminEventResult | null> {
  await requireAdmin();
  const saved = await fetchEventMutationResult(supabaseAdmin, id);
  if (saved) {
    revalidatePath("/admin/events", "layout");
    revalidatePath("/portal/events", "layout");
    revalidatePath("/events", "layout");
  }
  return saved;
}

export async function savePastEventResourcesAction(input: { eventId: string; revision: number; operationId: string; content: EventContent }): Promise<SaveAdminEventResult> {
  await requireAdmin();
  const problem = eventContentProblem({ ...input.content, sections: [] });
  if (problem) return { error: problem };
  const { data, error } = await supabaseAdmin.rpc("save_past_event_resources", {
    p_event_id: input.eventId, p_revision: input.revision, p_operation_id: input.operationId,
    p_links: input.content.links as unknown as Json,
    p_resources_version: input.content.resources_version,
  });
  if (error) {
    if (["EVENT_REVISION_CONFLICT", "EVENT_HISTORY_LOCKED", "EVENT_CONTENT_INVALID"].includes(error.hint ?? "")) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/events", "layout");
  revalidatePath("/portal/events", "layout");
  revalidatePath("/events", "layout");
  return eventMutationResult(data);
}

export async function loadAdminEventDeletionInfoAction(eventId: string) {
  await requireAdmin();
  const event = await fetchEventById(supabaseAdmin, eventId);
  if (!event) return null;
  // The service role counts drafts too, which deletion takes with the rest.
  const [history, blockers] = await Promise.all([fetchEventHistoryInfo(supabaseAdmin, eventId), fetchEventDeletionBlockers(supabaseAdmin, eventId)]);
  return { name: event.name, ...history, blockers, blocked: eventDeletionBlocked(blockers) };
}

export async function recoverAdminEventDraftAction(id: string, operationId?: string) {
  await requireAdmin();
  if (operationId) return recoverEventDraftReceipt(supabaseAdmin, operationId);
  const draft = await fetchEventDraft(supabaseAdmin, id);
  if (!draft) return null;
  return { revision: draft.revision, document: draft.document, eventRevision: draft.event_revision ?? undefined };
}
