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

describe("groupEventsByMonth with an ongoing cutoff", () => {
  // Monday, November 16, 2026, noon in Vancouver.
  const now = "2026-11-16T12:00:00-07:00";
  const series = event("series", "2026-05-19T17:00:00Z", "2028-11-19T18:30:00Z");
  const running = event("sprint", "2026-11-13T17:00:00Z", "2026-11-18T23:00:00Z");
  const laterThisMonth = event("jam", "2026-11-29T17:00:00Z");
  const nextMonth = event("tour", "2026-12-10T20:00:00Z");

  it("puts what has started under Ongoing, and later events under their own month", () => {
    const groups = groupEventsByMonth([series, running, laterThisMonth, nextMonth], { ongoingAt: now });
    expect(groups.map((group) => [group.label, group.events.map((e) => e.id)])).toEqual([
      ["Ongoing", ["series", "sprint"]],
      ["November 2026", ["jam"]],
      ["December 2026", ["tour"]],
    ]);
  });

  it("has no Ongoing group when nothing has started yet", () => {
    const groups = groupEventsByMonth([laterThisMonth, nextMonth], { ongoingAt: now });
    expect(groups.map((group) => group.label)).toEqual(["November 2026", "December 2026"]);
  });

  it("groups by start month without a cutoff, as the past list does", () => {
    expect(groupEventsByMonth([series, nextMonth]).map((group) => group.key)).toEqual(["2026-05", "2026-12"]);
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