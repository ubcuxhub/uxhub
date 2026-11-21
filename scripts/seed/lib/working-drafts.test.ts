import { describe, expect, it } from "vitest";

import { getInitialFormState } from "../../../src/features/admin/components/event-form/event-form-schema.ts";
import { parseWorkingDocument } from "../../../src/features/admin/lib/event-working-document.ts";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedWorkingDrafts } from "../data/drafts.ts";
import { BUILDER_DEFAULTS, buildWorkingDocument, seedWorkingDraftId } from "./working-drafts.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const drafts = buildSeedWorkingDrafts(fixedNow);
const imageUrl = (key: string) => `http://127.0.0.1:54321/storage/v1/object/public/event-images/seed/covers/${key}`;

describe("seeded working drafts", () => {
  it("start from the builder's own defaults", () => {
    // The seed can't import the form schema at run time (it uses `@/*`).
    expect(BUILDER_DEFAULTS).toEqual({ ...getInitialFormState(), date_location: null });
  });

  it("are documents the builder accepts", () => {
    for (const draft of drafts) {
      const document = buildWorkingDocument(draft, imageUrl);
      // parseWorkingDocument drops nothing a builder save would keep.
      expect(parseWorkingDocument(document)).toEqual(document);
    }
  });

  it("are unfinished in different ways, and never collide with a finished fixture", () => {
    const [started, nearlyDone] = drafts.map((draft) => buildWorkingDocument(draft, imageUrl).formState);
    // Barely started: no dates, cover or price.
    expect(started).toMatchObject({ starts_at: "", image_url: "", pricing_mode: "paid", pricing_amount: "" });
    // Nearly finished: dated and illustrated, but no long overview.
    expect(nearlyDone.starts_at).not.toBe("");
    expect(nearlyDone.header_image_url).toContain("banner-");
    expect(nearlyDone.header_colour).toBe("");
    expect(nearlyDone.description).toBe("");

    const finished = new Set(buildSeedEvents(fixedNow).map((seed) => seed.event.slug));
    for (const draft of drafts) expect(finished.has(draft.slug)).toBe(false);
    expect(new Set(drafts.map((draft) => seedWorkingDraftId(draft.slug))).size).toBe(drafts.length);
  });

  it("are stable across runs on the same day", () => {
    const again = buildSeedWorkingDrafts(new Date(fixedNow.getTime() + 60 * 60 * 1000));
    expect(again.map((draft) => buildWorkingDocument(draft, imageUrl))).toEqual(
      drafts.map((draft) => buildWorkingDocument(draft, imageUrl))
    );
  });
});
