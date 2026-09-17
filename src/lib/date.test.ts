import { describe, expect, it } from "vitest";

import {
  datetimeLocalToTimestamptz,
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getPacificStartDefaults,
  timestamptzToDatetimeLocal,
} from "./date";

// Every expectation below is Vancouver time regardless of where the test runs.
// The bug class these guard against is a date that drifts by a day, or an hour
// that drifts across a DST boundary, because something fell back to the
// machine's own timezone.

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
  });

  it("renders a timestamp on its Pacific calendar day, not its UTC one", () => {
    // 02:30 UTC on the 15th is still the evening of the 14th in Vancouver.
    expect(formatEventDate("2026-07-15T02:30:00Z")).toBe("July 14, 2026");
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

  it.each([
    ["09:30", "9:30 a.m."],
    ["13:05", "1:05 p.m."],
    ["00:15", "12:15 a.m."],
    ["12:00", "12:00 p.m."],
  ])("formats the bare clock time %s as %s", (input, expected) => {
    expect(formatEventTime(input)).toBe(expected);
  });

  it("returns the raw value for an out-of-range hour", () => {
    expect(formatEventTime("24:00")).toBe("24:00");
    expect(formatEventTime("nope")).toBe("nope");
  });

  it("converts a timestamp to Pacific time", () => {
    expect(formatEventTime("2026-07-15T02:30:00Z")).toBe("7:30 p.m.");
  });
});

describe("formatTimestamp", () => {
  it("returns null for a missing value", () => {
    expect(formatTimestamp(null)).toBeNull();
  });

  it("renders date and time in Pacific time", () => {
    expect(formatTimestamp("2026-07-15T02:30:00Z")).toBe(
      "Jul 14, 2026, 7:30 p.m."
    );
  });

  it("returns the raw value unchanged when it cannot be parsed", () => {
    expect(formatTimestamp("garbage")).toBe("garbage");
  });
});

describe("getPacificStartDefaults", () => {
  // The form defaults are what an admin sees before touching anything, so a
  // UTC reading here would pre-fill tomorrow's date all evening.
  it("uses the Pacific calendar day, not the UTC one", () => {
    expect(getPacificStartDefaults(new Date("2026-07-15T02:30:00Z"))).toEqual({
      start_date: "2026-07-14",
      start_time: "19:30",
    });
  });

  it("zero-pads a single-digit month, day and hour", () => {
    expect(getPacificStartDefaults(new Date("2026-03-09T16:05:00Z"))).toEqual({
      start_date: "2026-03-09",
      start_time: "09:05",
    });
  });
});

describe("timestamptzToDatetimeLocal", () => {
  it("returns an empty string for a missing or unparseable value", () => {
    expect(timestamptzToDatetimeLocal(null)).toBe("");
    expect(timestamptzToDatetimeLocal(undefined)).toBe("");
    expect(timestamptzToDatetimeLocal("")).toBe("");
    expect(timestamptzToDatetimeLocal("not a timestamp")).toBe("");
  });

  it("renders the instant as a Pacific wall-clock value", () => {
    // PST: UTC-8.
    expect(timestamptzToDatetimeLocal("2026-01-15T17:00:00Z")).toBe(
      "2026-01-15T09:00"
    );
    // PDT: UTC-7.
    expect(timestamptzToDatetimeLocal("2026-07-15T16:00:00Z")).toBe(
      "2026-07-15T09:00"
    );
  });
});

describe("datetimeLocalToTimestamptz", () => {
  it("returns null for an empty or malformed value", () => {
    expect(datetimeLocalToTimestamptz("")).toBeNull();
    expect(datetimeLocalToTimestamptz("2026-07-15")).toBeNull();
    expect(datetimeLocalToTimestamptz("15/07/2026 09:00")).toBeNull();
  });

  it("reads the input as Pacific wall-clock time in winter and summer", () => {
    expect(datetimeLocalToTimestamptz("2026-01-15T09:00")).toBe(
      "2026-01-15T17:00:00.000Z"
    );
    expect(datetimeLocalToTimestamptz("2026-07-15T09:00")).toBe(
      "2026-07-15T16:00:00.000Z"
    );
  });

  it("accepts an optional seconds component", () => {
    expect(datetimeLocalToTimestamptz("2026-07-15T09:00:30")).toBe(
      "2026-07-15T16:00:30.000Z"
    );
  });

  // Spring forward is 2026-03-08 and fall back is 2026-11-01. The two-pass
  // correction in the implementation exists for these; a single pass lands an
  // hour off on the far side of the transition.
  it.each([
    "2026-01-15T09:00",
    "2026-07-15T09:00",
    "2026-03-08T01:30",
    "2026-03-08T03:30",
    "2026-11-01T01:30",
    "2026-11-01T03:30",
  ])("round-trips %s through the Pacific offset unchanged", (local) => {
    const instant = datetimeLocalToTimestamptz(local);

    expect(instant).not.toBeNull();
    expect(timestamptzToDatetimeLocal(instant)).toBe(local);
  });
});
