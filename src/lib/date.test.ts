import { afterEach, describe, expect, it, vi } from "vitest";

import {
  datetimeLocalToTimestamptz,
  endsOnLaterDay,
  formatEventDate,
  formatEventDateLabel,
  formatEventDateTimeLines,
  formatEventDateTimeRange,
  formatEventTime,
  formatTimestamp,
  pacificDate,
  timestamptzToDatetimeLocal,
} from "./date";

// Every expectation below is Vancouver time regardless of where the test runs.
// The bug class these guard against is a date that drifts by a day, or an hour
// that drifts across a DST boundary, because something fell back to the
// machine's own timezone or its tz database.
//
// Fixtures are UTC literals, not converted wall-clock times, so the expected
// strings pin the offset itself: UTC-8 in winter until 2026, UTC-7 in summer,
// and UTC-7 all year from March 8, 2026 (BC's permanent daylight time, IANA
// tzdata 2026c). A runtime with older tz data would read the winter-2026
// fixtures an hour earlier; the helpers must not.

describe("the Pacific offset", () => {
  it.each([
    // 2025: the ordinary North American rule.
    ["2025-01-15T17:00:00Z", "2025-01-15T09:00", "PST"],
    ["2025-03-09T09:59:00Z", "2025-03-09T01:59", "last PST minute before spring forward"],
    ["2025-03-09T10:00:00Z", "2025-03-09T03:00", "first PDT minute"],
    ["2025-07-15T16:00:00Z", "2025-07-15T09:00", "PDT"],
    ["2025-11-02T08:59:00Z", "2025-11-02T01:59", "last PDT minute before fall back"],
    ["2025-11-02T09:00:00Z", "2025-11-02T01:00", "first PST minute, 1 AM again"],
    ["2025-12-15T17:00:00Z", "2025-12-15T09:00", "PST"],
    // 2026: BC springs forward one last time.
    ["2026-03-08T09:59:00Z", "2026-03-08T01:59", "last PST minute ever"],
    ["2026-03-08T10:00:00Z", "2026-03-08T03:00", "permanent PDT begins"],
    // No fall back on Nov 1, 2026.
    ["2026-11-01T08:59:00Z", "2026-11-01T01:59", "where fall back would have been"],
    ["2026-11-01T09:00:00Z", "2026-11-01T02:00", "no repeated 1 AM"],
    ["2026-11-15T12:00:00Z", "2026-11-15T05:00", "UTC-7 in November"],
    ["2027-01-15T17:00:00Z", "2027-01-15T10:00", "UTC-7 in January"],
    ["2027-03-14T10:00:00Z", "2027-03-14T03:00", "no spring forward in 2027"],
    ["2030-12-25T08:00:00Z", "2030-12-25T01:00", "still UTC-7"],
  ])("reads %s as %s (%s)", (instant, local) => {
    expect(timestamptzToDatetimeLocal(instant)).toBe(local);
  });

  // Every tz database agrees with the rule before Nov 1, 2026, so this checks
  // the hand-written rule hour by hour against the runtime's own.
  it("matches Intl hour by hour from 2024 until the rules diverge", () => {
    const vancouver = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const mismatches: string[] = [];
    const end = Date.UTC(2026, 10, 1);
    for (let t = Date.UTC(2024, 0, 1); t < end; t += 60 * 60 * 1000) {
      const parts = Object.fromEntries(
        vancouver.formatToParts(new Date(t)).map((part) => [part.type, part.value])
      );
      const expected = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
      const actual = timestamptzToDatetimeLocal(new Date(t).toISOString());
      if (actual !== expected) mismatches.push(`${new Date(t).toISOString()}: ${actual} ≠ ${expected}`);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("independence from the runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The server and a student's browser must render the same text, whatever
  // tz data or locale each has, or React reports a hydration mismatch.
  it("formats without asking Intl about time zones or locales", () => {
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: () => {
        throw new Error("Intl.DateTimeFormat used");
      },
    });
    const start = "2026-11-15T02:00:00Z";
    const end = "2026-11-15T07:00:00Z";

    expect(formatEventDate(start)).toBe("November 14, 2026");
    expect(formatEventTime(start)).toBe("7:00 PM");
    expect(formatTimestamp(start)).toBe("Nov 14, 2026, 7:00 PM");
    expect(formatEventDateLabel(start, end)).toBe("Nov 14");
    expect(formatEventDateTimeRange(start, end)).toBe("Sat, Nov 14 7:00 PM–12:00 AM");
    expect(timestamptzToDatetimeLocal(start)).toBe("2026-11-14T19:00");
    expect(datetimeLocalToTimestamptz("2026-11-14T19:00")).toBe("2026-11-15T02:00:00.000Z");
  });
});

describe("formatEventDate", () => {
  it("returns null for a missing value", () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate(undefined)).toBeNull();
    expect(formatEventDate("")).toBeNull();
  });

  // A bare date is anchored at midday UTC precisely so it cannot slip to the
  // previous day when rendered in Pacific time.
  it("keeps a date-only value on its own day", () => {
    expect(formatEventDate("2026-07-04")).toBe("July 4, 2026");
    expect(formatEventDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatEventDate("2027-01-01")).toBe("January 1, 2027");
  });

  it.each([
    // 02:30 UTC on the 15th is still the evening of the 14th in Vancouver.
    ["2026-07-15T02:30:00Z", "July 14, 2026"],
    // Pacific midnight in PST (2025) and in permanent PDT (2026 onward).
    ["2025-12-15T07:59:59Z", "December 14, 2025"],
    ["2025-12-15T08:00:00Z", "December 15, 2025"],
    ["2026-11-15T06:59:59Z", "November 14, 2026"],
    ["2026-11-15T07:00:00Z", "November 15, 2026"],
    ["2027-01-01T06:59:59Z", "December 31, 2026"],
    ["2027-01-01T07:00:00Z", "January 1, 2027"],
  ])("renders %s on its Pacific day, %s", (value, expected) => {
    expect(formatEventDate(value)).toBe(expected);
  });

  it.each<[Parameters<typeof formatEventDate>[1], string]>([
    [{}, "September 5, 2026"],
    [{ month: "short" }, "Sep 5, 2026"],
    [{ year: "numeric", month: "short" }, "Sep 5, 2026"],
    [{ weekday: "long" }, "Saturday, September 5, 2026"],
    [{ weekday: "short", month: "short", year: undefined }, "Sat, Sep 5"],
    [{ day: undefined }, "September 2026"],
    [{ day: undefined, month: "short" }, "Sep 2026"],
  ])("with %j writes %s", (options, expected) => {
    expect(formatEventDate("2026-09-05T19:00:00Z", options)).toBe(expected);
  });

  it("returns the raw value unchanged when it cannot be parsed", () => {
    expect(formatEventDate("not a date")).toBe("not a date");
  });
});

describe("formatEventTime", () => {
  it("returns null for a missing value", () => {
    expect(formatEventTime(null)).toBeNull();
    expect(formatEventTime("")).toBeNull();
  });

  // One format everywhere (§2.9): "7:00 PM", with a plain space.
  it.each([
    ["09:30", "9:30 AM"],
    ["13:05", "1:05 PM"],
    ["00:15", "12:15 AM"],
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["19:00:00", "7:00 PM"],
  ])("formats the bare clock time %s as %s", (input, expected) => {
    expect(formatEventTime(input)).toBe(expected);
  });

  it.each(["24:00", "12:60", "nope"])("returns %s unchanged", (input) => {
    expect(formatEventTime(input)).toBe(input);
  });

  it.each([
    ["2026-07-15T02:30:00Z", "7:30 PM"],
    ["2026-01-15T03:00:00Z", "7:00 PM"],
    ["2025-12-15T03:00:00Z", "7:00 PM"],
    // Permanent PDT: older tz data would say 6:00 PM.
    ["2026-11-15T02:00:00Z", "7:00 PM"],
    ["2027-01-16T02:00:00Z", "7:00 PM"],
    ["2026-11-15T07:00:00Z", "12:00 AM"],
  ])("converts the timestamp %s to Pacific time, %s", (input, expected) => {
    expect(formatEventTime(input)).toBe(expected);
  });
});

describe("formatTimestamp", () => {
  it("returns null for a missing value", () => {
    expect(formatTimestamp(null)).toBeNull();
  });

  it.each([
    ["2026-07-15T02:30:00Z", "Jul 14, 2026, 7:30 PM"],
    ["2026-11-15T07:05:00Z", "Nov 15, 2026, 12:05 AM"],
    ["2026-09-01T19:00:00Z", "Sep 1, 2026, 12:00 PM"],
  ])("renders %s as %s", (input, expected) => {
    expect(formatTimestamp(input)).toBe(expected);
  });

  it("returns the raw value unchanged when it cannot be parsed", () => {
    expect(formatTimestamp("garbage")).toBe("garbage");
  });
});

describe("pacificDate", () => {
  // Grouping and "today" checks read this, so a UTC reading would move an
  // evening event onto the next day.
  it.each([
    ["2026-07-15T02:30:00Z", "2026-07-14"],
    ["2025-12-15T07:59:59Z", "2025-12-14"],
    ["2025-12-15T08:00:00Z", "2025-12-15"],
    ["2026-11-15T06:59:59Z", "2026-11-14"],
    ["2026-11-15T07:00:00Z", "2026-11-15"],
  ])("puts %s on %s", (input, expected) => {
    expect(pacificDate(input)).toBe(expected);
  });

  it("returns an empty string for a missing or unparseable value", () => {
    expect(pacificDate(null)).toBe("");
    expect(pacificDate("nope")).toBe("");
  });
});

describe("timestamptzToDatetimeLocal", () => {
  it("returns an empty string for a missing or unparseable value", () => {
    expect(timestamptzToDatetimeLocal(null)).toBe("");
    expect(timestamptzToDatetimeLocal(undefined)).toBe("");
    expect(timestamptzToDatetimeLocal("")).toBe("");
    expect(timestamptzToDatetimeLocal("not a timestamp")).toBe("");
  });
});

describe("datetimeLocalToTimestamptz", () => {
  it("returns null for an empty or malformed value", () => {
    expect(datetimeLocalToTimestamptz("")).toBeNull();
    expect(datetimeLocalToTimestamptz("2026-07-15")).toBeNull();
    expect(datetimeLocalToTimestamptz("15/07/2026 09:00")).toBeNull();
  });

  it.each([
    ["2025-01-15T09:00", "2025-01-15T17:00:00.000Z", "PST"],
    ["2026-01-15T09:00", "2026-01-15T17:00:00.000Z", "PST"],
    ["2026-07-15T09:00", "2026-07-15T16:00:00.000Z", "PDT"],
    ["2026-07-15T09:00:30", "2026-07-15T16:00:30.000Z", "with seconds"],
    // An admin types 7 PM for a November 2026 event: UTC-7, not UTC-8.
    ["2026-11-14T19:00", "2026-11-15T02:00:00.000Z", "permanent PDT"],
    ["2027-01-15T09:00", "2027-01-15T16:00:00.000Z", "permanent PDT in January"],
    // 2:30 AM never happens on a spring-forward day: read as 3:30 AM PDT.
    ["2025-03-09T02:30", "2025-03-09T10:30:00.000Z", "skipped hour"],
    ["2026-03-08T02:30", "2026-03-08T10:30:00.000Z", "skipped hour, 2026"],
    // 1:30 AM happens twice on a fall-back day: the first, in PDT.
    ["2025-11-02T01:30", "2025-11-02T08:30:00.000Z", "repeated hour"],
    // ...but only once in 2026, which has no fall back.
    ["2026-11-01T01:30", "2026-11-01T08:30:00.000Z", "no fall back"],
    ["2026-11-01T03:30", "2026-11-01T10:30:00.000Z", "no fall back"],
  ])("reads %s as %s (%s)", (local, instant) => {
    expect(datetimeLocalToTimestamptz(local)).toBe(instant);
  });

  it.each([
    "2025-01-15T09:00",
    "2025-11-02T00:30",
    "2025-11-02T03:30",
    "2026-01-15T09:00",
    "2026-03-08T01:30",
    "2026-03-08T03:30",
    "2026-07-15T09:00",
    "2026-11-01T01:30",
    "2026-11-01T03:30",
    "2026-11-14T23:59",
    "2026-11-15T00:00",
    "2027-03-14T02:30",
  ])("round-trips %s through the Pacific offset unchanged", (local) => {
    const instant = datetimeLocalToTimestamptz(local);

    expect(instant).not.toBeNull();
    expect(timestamptzToDatetimeLocal(instant)).toBe(local);
  });
});

// Fixtures are written as Vancouver wall-clock times and converted.
const at = (local: string) => datetimeLocalToTimestamptz(local)!;

// [description, start, end, label, lines, endsOnLaterDay]
const schedules: [string, string, string | null, string, string[], boolean][] = [
  ["no end", at("2027-01-09T09:00"), null, "Jan 9", ["Sat, Jan 9 9:00 AM"], false],
  ["same day", at("2027-01-09T09:00"), at("2027-01-09T19:00"), "Jan 9", ["Sat, Jan 9 9:00 AM–7:00 PM"], false],
  ["end equals start", at("2027-01-09T09:00"), at("2027-01-09T09:00"), "Jan 9", ["Sat, Jan 9 9:00 AM"], false],
  ["end before start", at("2027-01-09T19:00"), at("2027-01-09T18:00"), "Jan 9", ["Sat, Jan 9 7:00 PM"], false],
  ["end a day before start", at("2027-01-09T19:00"), at("2027-01-08T20:00"), "Jan 9", ["Sat, Jan 9 7:00 PM"], false],
  // Midnight and late-night ends belong to the start day.
  ["ends at midnight", at("2026-11-14T19:00"), at("2026-11-15T00:00"), "Nov 14", ["Sat, Nov 14 7:00 PM–12:00 AM"], false],
  ["runs to 1 AM", at("2026-11-14T19:00"), at("2026-11-15T01:00"), "Nov 14", ["Sat, Nov 14 7:00 PM–1:00 AM"], false],
  ["runs to 6 AM", at("2026-11-14T21:00"), at("2026-11-15T06:00"), "Nov 14", ["Sat, Nov 14 9:00 PM–6:00 AM"], false],
  ["runs past 6 AM", at("2026-11-14T21:00"), at("2026-11-15T06:01"), "Nov 14–15", ["Sat, Nov 14 9:00 PM", "Sun, Nov 15 6:01 AM"], true],
  ["runs a full day", at("2026-11-14T05:00"), at("2026-11-15T05:00"), "Nov 14–15", ["Sat, Nov 14 5:00 AM", "Sun, Nov 15 5:00 AM"], true],
  ["midnight two days on", at("2027-01-09T09:00"), at("2027-01-11T00:00"), "Jan 9–11", ["Sat, Jan 9 9:00 AM", "Mon, Jan 11 12:00 AM"], true],
  ["midnight across a month", at("2027-01-31T19:00"), at("2027-02-01T00:00"), "Jan 31", ["Sun, Jan 31 7:00 PM–12:00 AM"], false],
  ["midnight across a year", at("2026-12-31T20:00"), at("2027-01-01T00:00"), "Dec 31", ["Thu, Dec 31 8:00 PM–12:00 AM"], false],
  // UTC literals pin the offset: in PST (2025) and permanent PDT (2026).
  ["midnight, PST", "2025-12-13T03:00:00Z", "2025-12-13T08:00:00Z", "Dec 12", ["Fri, Dec 12 7:00 PM–12:00 AM"], false],
  ["midnight, permanent PDT", "2026-11-15T02:00:00Z", "2026-11-15T07:00:00Z", "Nov 14", ["Sat, Nov 14 7:00 PM–12:00 AM"], false],
  // 06:30 UTC on Jul 11 is 11:30 PM on Jul 10 in Vancouver.
  ["UTC-midnight boundary", at("2027-07-10T09:00"), "2027-07-11T06:30:00Z", "Jul 10", ["Sat, Jul 10 9:00 AM–11:30 PM"], false],
  ["two days", at("2027-01-09T09:00"), at("2027-01-10T15:00"), "Jan 9–10", ["Sat, Jan 9 9:00 AM", "Sun, Jan 10 3:00 PM"], true],
  ["across a month", at("2027-01-30T09:00"), at("2027-02-02T15:00"), "Jan 30–Feb 2", ["Sat, Jan 30 9:00 AM", "Tue, Feb 2 3:00 PM"], true],
  ["across a year", at("2026-12-30T09:00"), at("2027-01-02T15:00"), "Dec 30, 2026–Jan 2, 2027", ["Wed, Dec 30 9:00 AM", "Sat, Jan 2 3:00 PM"], true],
  // Spans the Nov 1, 2026 date that used to be fall back.
  ["across Nov 1, 2026", at("2026-10-31T10:00"), at("2026-11-01T14:00"), "Oct 31–Nov 1", ["Sat, Oct 31 10:00 AM", "Sun, Nov 1 2:00 PM"], true],
];

describe.each(schedules)("a schedule: %s", (_, start, end, label, lines, laterDay) => {
  it(`is labelled ${label}`, () => {
    expect(formatEventDateLabel(start, end)).toBe(label);
  });

  it("splits into its lines", () => {
    expect(
      formatEventDateTimeLines(start, end).map((line) => `${line.day} ${line.time}`)
    ).toEqual(lines);
  });

  it("joins into one range", () => {
    expect(formatEventDateTimeRange(start, end)).toBe(lines.join(" – "));
  });

  it(`${laterDay ? "ends" : "does not end"} on a later day`, () => {
    expect(endsOnLaterDay(start, end)).toBe(laterDay);
  });
});

describe("schedule helpers without a start", () => {
  it.each([null, undefined, "", "not a date"])("handle %j", (start) => {
    expect(formatEventDateLabel(start, null)).toBeNull();
    expect(formatEventDateTimeLines(start, null)).toEqual([]);
    expect(formatEventDateTimeRange(start, null)).toBeNull();
    expect(endsOnLaterDay(start, "2027-01-10T00:00:00Z")).toBe(false);
  });
});

describe("formatEventDateTimeRange", () => {
  it("uses a plain space before AM and PM", () => {
    expect(formatEventDateTimeRange(at("2027-01-09T09:00"), at("2027-01-09T19:00"))).not.toMatch(
      /[  ]/
    );
  });
});
