import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/supabase/models";

import { groupEventsByMonth, splitEventsByDate } from "./event-timeline";

const event = (id: string, start_date: string | null, end_date: string | null = null) =>
  ({ id, start_date, end_date }) as EventRow;

describe("splitEventsByDate", () => {
  it("counts an event happening today as upcoming", () => {
    const { upcomingEvents, pastEvents } = splitEventsByDate([event("a", "2026-10-26")], "2026-10-26");
    expect(upcomingEvents.map((e) => e.id)).toEqual(["a"]);
    expect(pastEvents).toEqual([]);
  });

  it("lists past events newest first", () => {
    const events = [event("old", "2026-01-01"), event("new", "2026-09-01")];
    expect(splitEventsByDate(events, "2026-10-06").pastEvents.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("skips events without a date", () => {
    const { upcomingEvents, pastEvents } = splitEventsByDate([event("a", null)], "2026-10-06");
    expect([...upcomingEvents, ...pastEvents]).toEqual([]);
  });

  it("counts a multi-day event currently happening as upcoming", () => {
    const events = [event("multi-day", "2026-10-01", "2026-10-03")];
    const { upcomingEvents, pastEvents } = splitEventsByDate(events, "2026-10-02");
    expect(upcomingEvents.map((e) => e.id)).toEqual(["multi-day"]);
    expect(pastEvents).toEqual([]);
  });

  it("considers an event's end date when determining if it is past or upcoming", () => {
    const events = [event("multi-day", "2026-10-01", "2026-10-03")];
    const { upcomingEvents, pastEvents } = splitEventsByDate(events, "2026-10-04");
    expect(upcomingEvents).toEqual([]);
    expect(pastEvents.map((e) => e.id)).toEqual(["multi-day"]);
  });
});

describe("groupEventsByMonth", () => {
  it("keeps the first of the month in that month", () => {
    const [group] = groupEventsByMonth([event("a", "2026-10-01")]);
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