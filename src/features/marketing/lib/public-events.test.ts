import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/supabase/models";

import { listPublicEvents } from "./public-events";

const event = (id: string, starts_at: string, over: Partial<EventRow> = {}) =>
  ({
    id, slug: id, starts_at, ends_at: null,
    configured_marketing_mode: null, configured_marketing_url: null, marketing_url: null,
    ...over,
  }) as EventRow;

describe("listPublicEvents", () => {
  const now = new Date("2026-11-20T19:00:00Z");

  it("keeps an event in progress upcoming and lists past ones most recent first", () => {
    const { upcoming, past } = listPublicEvents([
      event("old", "2026-01-01T18:00:00Z"),
      event("newer", "2026-06-01T18:00:00Z"),
      event("running", "2026-11-20T18:00:00Z", { ends_at: "2026-11-20T21:00:00Z" }),
      event("next", "2026-12-01T18:00:00Z"),
    ], now);
    expect(upcoming.map((e) => e.event.id)).toEqual(["running", "next"]);
    expect(past.map((e) => e.event.id)).toEqual(["newer", "old"]);
  });

  it("links hosted pages here and external ones out, and leaves out switched-off ones", () => {
    const { upcoming } = listPublicEvents([
      event("hosted", "2026-12-01T18:00:00Z", { configured_marketing_mode: "hosted" }),
      event("off", "2026-12-02T18:00:00Z", { configured_marketing_mode: "disabled" }),
      event("ext", "2026-12-03T18:00:00Z", { configured_marketing_mode: "external", configured_marketing_url: "https://example.com/e" }),
    ], now);
    expect(upcoming.map(({ event, ...link }) => ({ id: event.id, ...link }))).toEqual([
      { id: "hosted", href: "/events/hosted", external: false },
      { id: "ext", href: "https://example.com/e", external: true },
    ]);
  });
});
