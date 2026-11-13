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
 * change (the audit log trigger reads `auth.uid()`). The events UPDATE policy
 * admits the `admin` role only, though, not `manager` (which arrived later and
 * passes `requireAdmin()`), so a manager's change goes through the service
 * role as the builder's save does, and isn't attributed.
 */
export async function updateEventScheduleAction(
  eventId: string,
  input: EventScheduleInput
): Promise<UpdateEventScheduleResult> {
  const user = await requireAdmin();

  if (typeof eventId !== "string" || !isUuid(eventId)) {
    return { ok: false, error: NOT_FOUND };
  }
  const problem = eventScheduleProblem(input ?? {});
  if (problem) return { ok: false, error: problem };

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

    if (isPublishing(current, { status: input.status, publish_at: patch.publish_at ?? null })) {
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

    const writer = user.role_access === "admin" ? supabase : supabaseAdmin;
    const saved = await updateEventSchedule(writer, eventId, patch);
    if (!saved) return { ok: false, error: NOT_FOUND };

    // The list and this event's overview (drawer and page), and the public
    // event pages, which show these dates and only active events.
    revalidatePath("/admin/events", "layout");
    revalidatePath("/events", "layout");
    return { ok: true, event: saved };
  } catch (error) {
    if (error && typeof error === "object" && "hint" in error && ["EVENT_SETTINGS_CONFLICT", "EVENT_HISTORY_LOCKED"].includes(String(error.hint)) && "message" in error && typeof error.message === "string") return { ok: false, error: error.message };
    log.error("admin.event_schedule_save_failed", {
      eventId,
      ...errorFields(error),
    });
    return { ok: false, error: SAVE_FAILED };
  }
}
