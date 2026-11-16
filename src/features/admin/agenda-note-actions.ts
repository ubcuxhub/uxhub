"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { saveAgendaNote, type AgendaNote } from "@/lib/supabase-helpers/event-agenda-notes";
import { isUuid } from "@/lib/uuid";

export type AgendaNoteActionResult =
  | { ok: true; note: AgendaNote }
  | { ok: false; error: string; current?: AgendaNote };

export async function saveAgendaNoteAction(input: {
  eventId: string; itemId: string; body: string; expectedRevision: number;
}): Promise<AgendaNoteActionResult> {
  await requireAdmin();
  if (!input || !isUuid(input.eventId) || !isUuid(input.itemId)
    || typeof input.body !== "string" || !Number.isSafeInteger(input.expectedRevision)
    || input.expectedRevision < 0) {
    return { ok: false, error: "This note could not be saved. Reload the agenda and try again." };
  }
  try {
    const result = await saveAgendaNote(await createClient(), input);
    if (!result.ok) return {
      ok: false, current: result.note,
      error: "This note changed. Your text is still here. Review the latest saved note before saving again.",
    };
    return { ok: true, note: result.note };
  } catch {
    // Do not log note bodies, URLs, or database error messages quoting values.
    log.warn("admin.agenda_note_save_failed", { eventId: input.eventId, itemId: input.itemId });
    return { ok: false, error: "Couldn’t save the note. Your text is still here. Try saving again." };
  }
}
