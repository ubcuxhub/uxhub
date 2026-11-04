import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/supabase/models";

import { groupEventsByMonth, splitEventsByTime } from "./event-timeline";

const event = (id: string, starts_at: string | null, ends_at: string | null = null) =>
  ({ id, starts_at, ends_at }) as EventRow;

describe("splitEventsByTime", () => {
  const now = new Date("2026-10-26T19:00:00Z");

  it("counts an event that hasn't ended yet as upcoming", () => {
    const events = [event("a", "2026-10-26T18:00:00Z", "2026-10-26T20:00:00Z")];
    const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
    expect(upcomingEvents.map((e) => e.id)).toEqual(["a"]);
    expect(pastEvents).toEqual([]);
  });

  it("counts an event that ended earlier today as past", () => {
    const events = [event("a", "2026-10-26T16:00:00Z", "2026-10-26T18:00:00Z")];
    expect(splitEventsByTime(events, now).pastEvents.map((e) => e.id)).toEqual(["a"]);
  });

  it("lists past events newest first", () => {
    const events = [event("old", "2026-01-01T18:00:00Z"), event("new", "2026-09-01T18:00:00Z")];
    expect(splitEventsByTime(events, now).pastEvents.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("skips events without a start", () => {
    const { upcomingEvents, pastEvents } = splitEventsByTime([event("a", null)], now);
    expect([...upcomingEvents, ...pastEvents]).toEqual([]);
  });

  it("counts a multi-day event currently happening as upcoming", () => {
    const events = [event("multi-day", "2026-10-25T16:00:00Z", "2026-10-27T01:00:00Z")];
    const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
    expect(upcomingEvents.map((e) => e.id)).toEqual(["multi-day"]);
    expect(pastEvents).toEqual([]);
  });

  it("falls back to the start for an event without an end", () => {
    const events = [event("a", "2026-10-26T18:00:00Z"), event("b", "2026-10-26T20:00:00Z")];
    const { upcomingEvents, pastEvents } = splitEventsByTime(events, now);
    expect(upcomingEvents.map((e) => e.id)).toEqual(["b"]);
    expect(pastEvents.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("groupEventsByMonth", () => {
  it("groups by the Pacific month, not the UTC one", () => {
    // 5 p.m. on October 31 in Vancouver, already November in UTC.
    const [group] = groupEventsByMonth([event("a", "2026-11-01T00:00:00Z")]);
    expect(group.key).toBe("2026-10");
    expect(group.label).toBe("October 2026");
  });
});

describe("normalizeString", () => {
  it("normalizes strings by trimming whitespace, lowercasing, and removing diacritics", async () => {
    const { normalizeString } = await import("./event-timeline");
    expect(normalizeString("  Café  ")).toBe("cafe");
    expect(normalizeString("Résumé")).toBe("resume");
    expect(normalizeString("naïve")).toBe("naive");
    expect(normalizeString(undefined)).toBe("");
  });
});