"use server";

import { revalidatePath } from "next/cache";

import {
  eventScheduleProblem,
  isPublishing,
  publicationReadinessProblem,
  type EventScheduleInput,
} from "@/features/admin/lib/event-publication";
import { requireAdmin } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/supabase/models";
import { fetchCheckInSessions } from "@/lib/supabase-helpers/check-ins";
import { fetchApplicationQuestions } from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventById,
  updateEventSchedule,
  type EventSchedulePatch,
} from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";
import { workingDocumentSaveInput } from "./lib/event-working-save";
import { eventWorkingDocument } from "./lib/event-presentation";
import { pacificDate } from "@/lib/date";
import { hasEventScheduleReceipt } from "@/lib/supabase-helpers/event-mutations";
import {
  cancelEvent,
  fetchEventLifecycleCounts,
  type EventLifecycleCounts,
} from "@/lib/supabase-helpers/event-lifecycle";

export type UpdateEventScheduleResult =
  | { ok: true; event: EventRow }
  | { ok: false; error: string };

const NOT_FOUND = "This event no longer exists.";
const SAVE_FAILED = "Couldn’t save the schedule. Try again.";

/**
 * The event overview's quick edit: status, publish date, event dates and the
 * registration window. Everything else stays in the builder (`/edit`).
 *
 * Returns the saved row, or why it wasn't saved; a refusal is a result, not a
 * throw, because a production server action hides thrown messages.
 *
 * Publishing a draft (now, or by giving it a publish date) runs the builder's
 * required-field validation on the stored event first, so the overview can't
 * publish an event the builder wouldn't save.
 *
 * The write goes through the signed-in admin's own client rather than the
 * service role, so RLS still applies and the database knows who made the
 * change (the audit log trigger reads `auth.uid()`). `update_admin_event_schedule`
 * is SECURITY DEFINER and gates on `is_admin()`, which admits managers too.
 */
export async function updateEventScheduleAction(
  eventId: string,
  input: EventScheduleInput
): Promise<UpdateEventScheduleResult> {
  await requireAdmin();

  if (typeof eventId !== "string" || !isUuid(eventId)) {
    return { ok: false, error: NOT_FOUND };
  }
  if (!input || (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0))) return { ok: false, error: SAVE_FAILED };
  if (input.operationId && !isUuid(input.operationId)) return { ok: false, error: SAVE_FAILED };
  const problem = eventScheduleProblem(input ?? {});
  if (problem && !input.operationId) return { ok: false, error: problem };

  const patch: EventSchedulePatch = {
    status: input.status,
    // Only a draft keeps a publish date; the database clears it otherwise.
    publish_at: input.status === "draft" ? input.publish_at ?? null : null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    registration_opens_at: input.registration_opens_at ?? null,
    registration_closes_at: input.registration_closes_at ?? null,
  };

  try {
    const supabase = await createClient();
    const current = await fetchEventById(supabase, eventId);
    if (!current) return { ok: false, error: NOT_FOUND };
    if (input.operationId && await hasEventScheduleReceipt(supabaseAdmin, input.operationId, eventId, input)) return { ok: true, event: current };
    if (problem) return { ok: false, error: problem };

    if (isPublishing(current, { status: input.status, publish_at: patch.publish_at ?? null })) {
      const agenda = eventWorkingDocument(current)?.formState.date_location;
      if (agenda?.version === 2 && (Date.parse(current.starts_at ?? "") !== Date.parse(input.starts_at ?? "") || Date.parse(current.ends_at ?? "") !== Date.parse(input.ends_at ?? ""))) return { ok: false, error: "Edit agenda item timing in the event builder." };
      const dates = agenda?.version === 2 ? undefined : agenda?.dates;
      if (dates && ((dates.length > 1 && (Date.parse(current.starts_at ?? "") !== Date.parse(input.starts_at ?? "") || Date.parse(current.ends_at ?? "") !== Date.parse(input.ends_at ?? ""))) || (dates.length === 1 && pacificDate(input.starts_at) !== pacificDate(input.ends_at)))) return { ok: false, error: "Edit individual event dates in the event form." };
      const workingInput = workingDocumentSaveInput(current, input);
      if (workingInput) {
        const { saveAdminEventAction } = await import("./actions");
        const result = await saveAdminEventAction(workingInput);
        if ("error" in result) return { ok: false, error: result.error };
        const saved = await fetchEventById(supabase, eventId);
        return saved ? { ok: true, event: saved } : { ok: false, error: NOT_FOUND };
      }
      const [checkInSessions, applicationQuestions] = await Promise.all([
        fetchCheckInSessions(supabase, eventId),
        fetchApplicationQuestions(supabase, eventId),
      ]);
      const notReady = publicationReadinessProblem({
        event: { ...current, ...patch },
        checkInSessions,
        applicationQuestions,
      });
      if (notReady) return { ok: false, error: notReady };
    }

    const saved = await updateEventSchedule(supabase, eventId, patch, input.expectedRevision ?? current.revision, input.operationId);
    if (!saved) return { ok: false, error: NOT_FOUND };

    // The list and this event's overview (drawer and page), and the public
    // event pages, which show these dates and only active events.
    revalidatePath("/admin/events", "layout");
    revalidatePath("/events", "layout");
    return { ok: true, event: saved };
  } catch (error) {
    if (error && typeof error === "object" && "hint" in error && ["EVENT_SETTINGS_CONFLICT", "EVENT_HISTORY_LOCKED", "EVENT_PUBLICATION_INVALID", "EVENT_REVISION_CONFLICT"].includes(String(error.hint)) && "message" in error && typeof error.message === "string") return { ok: false, error: error.message };
    log.error("admin.event_schedule_save_failed", {
      eventId,
      ...errorFields(error),
    });
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * The counts the revert and cancel dialogs show (`event_lifecycle_counts`):
 * members registered (which block a revert to Draft), members' open
 * applications (which lose access while it's a draft), and paid tickets to
 * refund after a cancel. Read-only; `null` when the event is gone.
 */
export async function loadEventLifecycleCountsAction(
  eventId: string
): Promise<EventLifecycleCounts | null> {
  await requireAdmin();
  if (typeof eventId !== "string" || !isUuid(eventId)) return null;
  const event = await fetchEventById(supabaseAdmin, eventId);
  if (!event) return null;
  return fetchEventLifecycleCounts(supabaseAdmin, eventId);
}

export type CancelEventResult =
  | { ok: true; event: EventRow }
  | { ok: false; error: string };

const CANCEL_FAILED = "Couldn’t cancel the event. Try again.";
const CANCEL_NOTE_LIMIT = 1000;

/**
 * Cancels a published event that hasn't ended, for good (docs/event-states.md,
 * "Canceled events"). Tickets, purchases, applications and teams stay; ticket
 * holders see the event as canceled, with `note`. Nothing is emailed and
 * nothing is refunded: staff refund paid tickets in Square.
 *
 * `operationId` is the caller's key for this attempt, so a retry after a lost
 * response returns the first result instead of a refusal.
 */
export async function cancelEventAction(
  eventId: string,
  input: { note: string | null; operationId: string }
): Promise<CancelEventResult> {
  await requireAdmin();
  if (typeof eventId !== "string" || !isUuid(eventId)) return { ok: false, error: NOT_FOUND };
  if (!input || typeof input.operationId !== "string" || !isUuid(input.operationId)) return { ok: false, error: CANCEL_FAILED };
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > CANCEL_NOTE_LIMIT) return { ok: false, error: `Keep the note to ${CANCEL_NOTE_LIMIT.toLocaleString("en-CA")} characters.` };

  try {
    const event = await cancelEvent(supabaseAdmin, eventId, note || null, input.operationId);
    log.info("admin.event_canceled", { eventId, operationId: input.operationId });
    // The list and overview, the builder, the portal and the public pages.
    revalidatePath("/admin/events", "layout");
    revalidatePath("/portal/events", "layout");
    revalidatePath("/events", "layout");
    return { ok: true, event };
  } catch (error) {
    const hint = error && typeof error === "object" && "hint" in error ? String(error.hint) : "";
    if (["EVENT_CANCEL_REFUSED", "EVENT_REVISION_CONFLICT"].includes(hint) && error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      log.warn("admin.event_cancel_refused", { eventId, hint });
      return { ok: false, error: error.message };
    }
    log.error("admin.event_cancel_failed", { eventId, ...errorFields(error) });
    return { ok: false, error: CANCEL_FAILED };
  }
}
