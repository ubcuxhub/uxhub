import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { Json } from "@/lib/supabase/database.types";
import { parseWorkingDocument, type EventWorkingDocument } from "@/features/admin/lib/event-working-document";
import { eventPresentation, eventWorkingDocument } from "@/features/admin/lib/event-presentation";
import type { EventRow } from "@/lib/supabase/models";
import { fetchEventRowByIdOrLegacyDraftId } from "./events";

/** An event's working document, by its id or a legacy draft id. */
export async function fetchEventDraft(supabase: DbClient, id: string) {
  const row = await fetchEventRowByIdOrLegacyDraftId(supabase, id);
  return row ? eventDraftFromRow(row) : null;
}

/** The working document a stored event row carries: an unscheduled draft's only. */
function eventDraftFromRow(row: EventRow) {
  const document = eventWorkingDocument(row);
  return document ? { id: row.id, event_id: row.id, revision: row.working_revision, event_revision: row.revision, document } : null;
}

/**
 * The builder's event and its working document from one read: the event as
 * the admin pages present it, and the draft from the stored row (presenting
 * it first would change what the draft reads). Null for an unknown id.
 */
export async function fetchEventWithDraft(supabase: DbClient, eventId: string) {
  const { data, error } = await supabase.from(TABLES.events).select("*").eq("id", eventId).maybeSingle();
  if (error) throw error;
  return data ? { event: eventPresentation(data), draft: eventDraftFromRow(data) } : null;
}
export async function saveEventDraft(supabase: DbClient, id: string, eventId: string | null, revision: number, input: EventWorkingDocument, eventRevision?: number, operationId?: string) {
  const document = parseWorkingDocument(input);
  // The generator omits SQL argument nullability; null denotes a new event.
  const { data, error } = await supabase.rpc("save_event_working_document", { p_id: id, p_event_id: eventId!, p_revision: revision, p_document: document as unknown as Json, p_event_revision: eventRevision!, p_operation_id: operationId! });
  if (error) {
    if (error.message.includes("DRAFT_CONFLICT")) throw new Error("This draft changed in another tab. Reload it before saving again.");
    if (error.code === "23505" && /events_slug|idx_events_slug|event_url_claims/.test(error.message)) throw new Error("This page URL is already in use.");
    throw error;
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.id !== id || typeof data.revision !== "number") throw new Error("The draft save returned no identity.");
  return {
    id,
    eventId: typeof data.event_id === "string" ? data.event_id : id,
    revision: data.revision,
    document: parseWorkingDocument(data.document),
    ...(typeof data.event_revision === "number" ? { eventRevision: data.event_revision } : {}),
  };
}
/** Cleanup must include both image kinds and durable drafts after response loss. */
export async function eventImageIsReferenced(supabase: DbClient, url: string) {
  const { data: events, error } = await supabase.from(TABLES.events).select("id").or(`image_url.eq.${JSON.stringify(url)},header_image_url.eq.${JSON.stringify(url)}`).limit(1);
  if (error) throw error;
  if (events?.length) return true;
  const { data: drafts, error: draftError } = await supabase.from(TABLES.events).select("id").or(`working_document->formState->>image_url.eq.${JSON.stringify(url)},working_document->formState->>header_image_url.eq.${JSON.stringify(url)}`).limit(1);
  if (draftError) throw draftError;
  if (drafts?.length) return true;
  const checks = await Promise.all([
    supabase.from(TABLES.mentors).select("id").eq("profile_image_path", url).limit(1),
    supabase.from(TABLES.sponsors).select("id").eq("brand_logo_path", url).limit(1),
    supabase.from(TABLES.eventContentSettings).select("event_id").contains("document", { sections: [{ items: [{ image_url: url }] }] }).limit(1),
    supabase.from(TABLES.events).select("id").contains("working_document", { formState: { content: { sections: [{ items: [{ image_url: url }] }] } } }).limit(1),
    supabase.from(TABLES.events).select("id").contains("working_document", { mentors: [{ profile_image_path: url }] }).limit(1),
    supabase.from(TABLES.events).select("id").contains("working_document", { sponsors: [{ brand_logo_path: url }] }).limit(1),
  ]);
  for (const result of checks) if (result.error) throw result.error;
  return checks.some(result => !!result.data?.length);
}

export async function recoverEventDraftReceipt(supabase: DbClient, operationId: string) {
  const { data, error } = await supabase.from(TABLES.adminEventMutations).select("result").eq("id", operationId).maybeSingle();
  if (error) throw error;
  const result = data?.result;
  if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.revision !== "number") return null;
  return { revision: result.revision, eventRevision: typeof result.event_revision === "number" ? result.event_revision : undefined, document: parseWorkingDocument(result.document) };
}
