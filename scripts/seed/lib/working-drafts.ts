/**
 * Writes `data/drafts.ts` through `save_event_working_document`, the RPC the
 * builder's Save draft calls, so the row is exactly what a builder save makes:
 * the document on `events.working_document`, its representable fields
 * projected into the columns, and the legacy `admin_event_drafts` mirror.
 *
 * Idempotent: the RPC returns early when the stored document equals the one
 * sent, so a second run changes nothing (not even `working_revision`). A run
 * after the draft was edited in the builder overwrites the edit, by sending
 * the row's current revision.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SeedWorkingDraft } from "../data/drafts.ts";
import { emptyCounts, type Counts, type ReconcileOptions } from "./reconcile.ts";

/** A fixed UUID per draft, so a fresh database gets the same IDs each time. */
export function seedWorkingDraftId(slug: string): string {
  const hex = createHash("sha256").update(`seed:working-draft:${slug}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The builder's form state for a new event (`getInitialFormState` in
 * src/features/admin/components/event-form/event-form-schema.ts), spelled out
 * because that module imports through the `@/*` alias Node can't resolve.
 * `working-drafts.test.ts` holds it to the app's own defaults.
 */
export const BUILDER_DEFAULTS = {
  content: null,
  date_location: null,
  date_location_revision: 0,
  configuration_initialized: true,
  marketing_mode: "hosted",
  marketing_url: "",
  page_slug: "",
  slug_edited: false,
  is_featured: false,
  pricing_mode: "free",
  pricing_amount: "0",
  name: "",
  short_description: "",
  description: "",
  description_rich: null,
  header_image_url: "",
  header_colour: "#325DC4",
  event_colour: "#325DC4",
  status: "draft",
  publish_at: "",
  event_type: "regular",
  regular_price: "",
  member_price: "",
  location_building: "",
  location_room: "",
  location_address_url: "",
  starts_at: "",
  ends_at: "",
  max_capacity: "",
  reminder_schedule: "1d",
  image_url: "",
  registration_opens_at: "",
  registration_closes_at: "",
  created_at: "",
  mentors_enabled: false,
  sponsors_enabled: false,
  schedule_configuration_initialized: true,
  agenda_enabled: false,
  teams_configuration_initialized: true,
  teams_enabled: false,
  min_team_size: "",
  max_team_size: "",
  team_deadline: "",
  requires_application: false,
  decisions_release_at: "",
  confirmation_deadline: "",
} as const;

/** The version-1 working document a builder save would send for the draft. */
export function buildWorkingDocument(
  draft: SeedWorkingDraft,
  imageUrl: (key: string) => string
) {
  const location = {
    type: "in_person", building: draft.location.building, room: draft.location.room, address: "",
    map_url: "", meeting_url: "", meeting_id: "", meeting_passcode: "", public_summary: "",
  };
  return {
    version: 1,
    formState: {
      ...BUILDER_DEFAULTS,
      ...draft.formState,
      page_slug: draft.slug,
      slug_edited: true,
      image_url: draft.imageKey ? imageUrl(draft.imageKey) : "",
      header_image_url: draft.bannerKey ? imageUrl(draft.bannerKey) : "",
      // Image mode clears the colour in the builder (EventBranding).
      ...(draft.bannerKey ? { header_colour: "" } : {}),
      location_building: draft.location.building,
      location_room: draft.location.room,
      date_location: {
        automatic: true,
        audience: "everyone",
        location,
        dates: draft.dates.map((row, index) => ({
          key: seedWorkingDraftId(`${draft.slug}:date:${index}`),
          session_id: null,
          ...row,
          location: null,
        })),
      },
    },
    checkInEvents: [],
    mentors: [],
    sponsors: [],
    applicationTemplate: [],
  };
}

export async function reconcileWorkingDrafts(
  client: SupabaseClient,
  drafts: SeedWorkingDraft[],
  imageUrl: (key: string) => string,
  options: ReconcileOptions
): Promise<Counts> {
  const counts = emptyCounts();
  if (drafts.length === 0) return counts;
  const { data, error } = await client
    .from("events")
    .select("id, slug, status, publish_at, working_revision")
    .in("slug", drafts.map((draft) => draft.slug));
  if (error) throw new Error(`Reading working drafts failed: ${error.message}`);
  const existing = new Map(
    ((data ?? []) as { id: string; slug: string; status: string; publish_at: string | null; working_revision: number }[])
      .map((row) => [row.slug, row])
  );

  for (const draft of drafts) {
    const row = existing.get(draft.slug);
    if (row) counts.updated += 1;
    else counts.created += 1;
    if (options.dryRun) continue;

    // Finished and published (or scheduled) through the app: the seed's data
    // says draft, and only an unscheduled draft takes a working document.
    if (row && (row.status !== "draft" || row.publish_at)) {
      const reset = await client.from("events").update({ status: "draft", publish_at: null }).eq("id", row.id);
      if (reset.error) throw new Error(`Returning "${draft.slug}" to draft failed: ${reset.error.message}`);
    }

    const { error: saveError } = await client.rpc("save_event_working_document", {
      p_id: row?.id ?? seedWorkingDraftId(draft.slug),
      p_event_id: row?.id ?? null,
      p_document: buildWorkingDocument(draft, imageUrl),
      p_revision: row?.working_revision ?? 0,
      p_event_revision: null,
      p_operation_id: null,
    });
    if (saveError) throw new Error(`Saving working draft "${draft.slug}" failed: ${saveError.message}`);
  }
  return counts;
}
