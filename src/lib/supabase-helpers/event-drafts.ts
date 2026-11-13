import { eventContentProblem } from "@/features/admin/lib/event-content";
import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { Json } from "@/lib/supabase/database.types";
import { parseWorkingDocument, type EventWorkingDocument } from "@/features/admin/lib/event-working-document";

export async function fetchEventDraft(supabase: DbClient, id: string) {
  const { data, error } = await supabase.from(TABLES.adminEventDrafts).select("*").eq("id", id).eq("materialized", false).maybeSingle();
  if (error) throw error;
  return data ? { ...data, document: parseWorkingDocument(data.document) } : null;
}
export async function fetchEventDraftForEvent(supabase: DbClient, eventId: string) {
  const { data, error } = await supabase.from(TABLES.adminEventDrafts).select("*").eq("event_id", eventId).eq("materialized", false).maybeSingle();
  if (error) throw error;
  return data ? { ...data, document: parseWorkingDocument(data.document) } : null;
}
export async function fetchEventDrafts(supabase: DbClient) {
  const { data, error } = await supabase.from(TABLES.adminEventDrafts).select("*").eq("materialized", false).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row, document: parseWorkingDocument(row.document) }));
}
export async function saveEventDraft(supabase: DbClient, id: string, eventId: string | null, revision: number, input: EventWorkingDocument) {
  const document = parseWorkingDocument(input);
  if (document.formState.content) {
    const problem = eventContentProblem(document.formState.content, true);
    if (problem) throw new Error(problem);
  }
  // The generator omits SQL argument nullability; null denotes a new event.
  const { data, error } = await supabase.rpc("save_admin_event_draft", { p_id: id, p_event_id: eventId!, p_revision: revision, p_document: document as unknown as Json });
  if (error) {
    if (error.message.includes("DRAFT_CONFLICT")) throw new Error("This draft changed in another tab. Reload it before saving again.");
    throw error;
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.id !== id || typeof data.revision !== "number") throw new Error("The draft save returned no identity.");
  return { id, revision: data.revision, document };
}
/** Cleanup must include both image kinds and durable drafts after response loss. */
export async function eventImageIsReferenced(supabase: DbClient, url: string) {
  const { data: events, error } = await supabase.from(TABLES.events).select("id").or(`image_url.eq.${JSON.stringify(url)},header_image_url.eq.${JSON.stringify(url)}`).limit(1);
  if (error) throw error;
  if (events?.length) return true;
  const { data: drafts, error: draftError } = await supabase.from(TABLES.adminEventDrafts).select("id").eq("materialized", false).or(`document->formState->>image_url.eq.${JSON.stringify(url)},document->formState->>header_image_url.eq.${JSON.stringify(url)}`).limit(1);
  if (draftError) throw draftError;
  if (drafts?.length) return true;
  const checks = await Promise.all([
    supabase.from(TABLES.mentors).select("id").eq("profile_image_path", url).limit(1),
    supabase.from(TABLES.sponsors).select("id").eq("brand_logo_path", url).limit(1),
    supabase.from(TABLES.eventContentSettings).select("event_id").contains("document", { sections: [{ items: [{ image_url: url }] }] }).limit(1),
    supabase.from(TABLES.adminEventDrafts).select("id").eq("materialized", false).contains("document", { formState: { content: { sections: [{ items: [{ image_url: url }] }] } } }).limit(1),
  ]);
  for (const result of checks) if (result.error) throw result.error;
  return checks.some(result => !!result.data?.length);
}
