import { describe, expect, it } from "vitest";

import {
  formatDateInput,
  formatDuration,
  formatTimeInput,
  isEndBeforeStart,
  parseDateInput,
  parseTimeInput,
  timeOptions,
  type IsoDate,
  type WallTime,
} from "./date-input";

const today = "2026-10-31" as IsoDate;

describe("parseDateInput", () => {
  it.each([
    ["Nov 14", "2026-11-14"],
    ["nov 14", "2026-11-14"],
    ["november 14 2027", "2027-11-14"],
    ["November 14, 2026", "2026-11-14"],
    ["14 Nov", "2026-11-14"],
    ["Nov 14th", "2026-11-14"],
    ["Sept 3", "2027-09-03"],
    ["11/14", "2026-11-14"],
    ["11/14/2026", "2026-11-14"],
    ["11/14/27", "2027-11-14"],
    ["2026-11-14", "2026-11-14"],
    ["Sat, Nov 14, 2026", "2026-11-14"],
    ["  Sat Nov 14  ", "2026-11-14"],
    ["today", "2026-10-31"],
    ["Tomorrow", "2026-11-01"],
  ])("reads %j as %s", (text, expected) => {
    expect(parseDateInput(text, { today })).toBe(expected);
  });

  it("takes the next occurrence on or after today when there is no year", () => {
    expect(parseDateInput("Oct 31", { today })).toBe("2026-10-31");
    expect(parseDateInput("Oct 30", { today })).toBe("2027-10-30");
    expect(parseDateInput("Jan 5", { today })).toBe("2027-01-05");
    expect(parseDateInput("Dec 31", { today })).toBe("2026-12-31");
  });

  it("finds the next Feb 29", () => {
    expect(parseDateInput("Feb 29", { today })).toBe("2028-02-29");
    expect(parseDateInput("Feb 29 2027", { today })).toBeNull();
  });

  it("keeps an explicit year, even in the past", () => {
    expect(parseDateInput("Nov 14 2020", { today })).toBe("2020-11-14");
  });

  it("applies min and max", () => {
    const opts = { today, min: today, max: "2026-12-31" as IsoDate };
    expect(parseDateInput("Oct 31", opts)).toBe("2026-10-31");
    expect(parseDateInput("Oct 30 2026", opts)).toBeNull();
    expect(parseDateInput("Dec 31", opts)).toBe("2026-12-31");
    expect(parseDateInput("Jan 1", opts)).toBeNull();
    expect(parseDateInput("yesterday", opts)).toBeNull();
  });

  // A yearless date takes the year that fits the range: the next occurrence
  // first, then the previous one, then further out. Today is Oct 31, 2026.
  it.each<[string, { min?: IsoDate; max?: IsoDate }, string | null]>([
    // A backfill field (max today): yesterday's date is this year's, not next.
    ["Oct 30", { max: today }, "2026-10-30"],
    ["Jan 5", { max: today }, "2026-01-05"],
    ["Oct 31", { max: today }, "2026-10-31"],
    ["11/14", { max: today }, "2025-11-14"],
    // A window wholly in the past.
    ["Mar 3", { min: "2025-01-01", max: "2025-12-31" }, "2025-03-03"],
    // A window wholly in the future, past the next occurrence.
    ["Mar 3", { min: "2028-01-01", max: "2028-12-31" }, "2028-03-03"],
    // Both occurrences fit: the next one wins.
    ["Oct 30", { min: "2025-01-01", max: "2027-12-31" }, "2027-10-30"],
    // A Feb 29 in a past window.
    ["Feb 29", { min: "2024-01-01", max: today }, "2024-02-29"],
    // Nothing fits.
    ["Oct 30", { min: today, max: "2026-12-31" }, null],
    ["Mar 3", { min: "2040-01-01" }, null],
  ])("reads %j within %j as %s", (text, range, expected) => {
    expect(parseDateInput(text, { today, ...range })).toBe(expected);
  });

  it.each(["", "   ", "abc", "Feb 30", "13/40", "0/5", "Nov", "Nov 32", "Foo 14", "14", "Nov 14 20"])(
    "rejects %j",
    (text) => {
      expect(parseDateInput(text, { today })).toBeNull();
    },
  );
});

describe("formatDateInput", () => {
  it("writes the house format with the year", () => {
    expect(formatDateInput("2026-11-14")).toBe("Sat, Nov 14, 2026");
    expect(formatDateInput("2027-01-05")).toBe("Tue, Jan 5, 2027");
    expect(formatDateInput("2028-02-29")).toBe("Tue, Feb 29, 2028");
  });

  it("round-trips through the parser", () => {
    for (const date of ["2026-11-14", "2026-12-31", "2027-02-01"] as IsoDate[]) {
      expect(parseDateInput(formatDateInput(date), { today })).toBe(date);
    }
  });
});

describe("parseTimeInput", () => {
  it.each([
    ["9", "21:00"],
    ["9pm", "21:00"],
    ["9 PM", "21:00"],
    ["9 p.m.", "21:00"],
    ["9am", "09:00"],
    ["9:30 a", "09:30"],
    ["9:30", "21:30"],
    ["12", "12:00"],
    ["12am", "00:00"],
    ["12:15 am", "00:15"],
    ["12pm", "12:00"],
    ["1", "13:00"],
    ["11", "23:00"],
    ["930", "21:30"],
    ["noon", "12:00"],
    ["Midnight", "00:00"],
  ])("reads %j as %s", (text, expected) => {
    expect(parseTimeInput(text)).toBe(expected);
  });

  it("reads 13-23 and zero-padded times as 24-hour", () => {
    expect(parseTimeInput("13")).toBe("13:00");
    expect(parseTimeInput("21:00")).toBe("21:00");
    expect(parseTimeInput("23:45")).toBe("23:45");
    expect(parseTimeInput("09:00")).toBe("09:00");
    expect(parseTimeInput("0930")).toBe("09:30");
    expect(parseTimeInput("09")).toBe("09:00");
    expect(parseTimeInput("00:30")).toBe("00:30");
    expect(parseTimeInput("0:30")).toBe("00:30");
  });

  it.each(["", "abc", "24", "25:00", "9:60", "13pm", "0am", "9:5", "9:30:00", "99"])(
    "rejects %j",
    (text) => {
      expect(parseTimeInput(text)).toBeNull();
    },
  );

  describe("with `after`", () => {
    const after = "09:00" as WallTime;

    it("takes the first match after the start", () => {
      expect(parseTimeInput("11", { after })).toBe("11:00");
      expect(parseTimeInput("10:30", { after })).toBe("10:30");
      expect(parseTimeInput("5", { after })).toBe("17:00");
      expect(parseTimeInput("12", { after })).toBe("12:00");
    });

    it("moves to PM when AM isn't after the start", () => {
      expect(parseTimeInput("9", { after })).toBe("21:00");
      expect(parseTimeInput("8", { after })).toBe("20:00");
    });

    it("leaves an explicit meridiem or 24-hour time alone", () => {
      expect(parseTimeInput("8am", { after })).toBe("08:00");
      expect(parseTimeInput("08:00", { after })).toBe("08:00");
      expect(parseTimeInput("20:00", { after })).toBe("20:00");
    });

    it("falls back to PM when nothing later fits", () => {
      expect(parseTimeInput("11", { after: "23:30" })).toBe("23:00");
    });
  });
});

describe("formatTimeInput", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:15", "12:15 AM"],
    ["09:00", "9:00 AM"],
    ["12:00", "12:00 PM"],
    ["13:05", "1:05 PM"],
    ["21:00", "9:00 PM"],
    ["23:45", "11:45 PM"],
  ])("writes %s as %s", (time, expected) => {
    expect(formatTimeInput(time as WallTime)).toBe(expected);
  });

  it("uses a plain space before AM/PM", () => {
    expect(formatTimeInput("09:00")).not.toMatch(/[  ]/);
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 hr"],
    [180, "3 hr"],
    [135, "2 hr 15 min"],
    [15, "15 min"],
    [0, "0 min"],
  ])("%i minutes is %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("timeOptions", () => {
  it("covers the day in 15-minute steps with no durations", () => {
    const options = timeOptions();
    expect(options).toHaveLength(96);
    expect(options[0]).toEqual({ value: "00:00", label: "12:00 AM" });
    expect(options.at(-1)).toEqual({ value: "23:45", label: "11:45 PM" });
    expect(options.some((option) => option.duration)).toBe(false);
  });

  it("honours the step", () => {
    expect(timeOptions({ stepMinutes: 30 })).toHaveLength(48);
    expect(timeOptions({ stepMinutes: 60 })[1].value).toBe("01:00");
  });

  it("starts after the start time and shows durations", () => {
    const options = timeOptions({ after: "10:00" });
    expect(options[0]).toEqual({ value: "10:15", label: "10:15 AM", duration: "15 min" });
    expect(options.find((o) => o.value === "12:15")?.duration).toBe("2 hr 15 min");
    expect(options.find((o) => o.value === "13:00")?.duration).toBe("3 hr");
    expect(options.at(-1)?.value).toBe("23:45");
  });

  it("starts at the next step when the start is off the grid", () => {
    expect(timeOptions({ after: "09:10" })[0]).toMatchObject({
      value: "09:15",
      duration: "5 min",
    });
  });

  it("is empty when nothing is left in the day", () => {
    expect(timeOptions({ after: "23:45" })).toEqual([]);
  });
});

describe("isEndBeforeStart", () => {
  it("is true only when the end is earlier", () => {
    expect(isEndBeforeStart("08:00", "09:00")).toBe(true);
    expect(isEndBeforeStart("09:00", "09:00")).toBe(false);
    expect(isEndBeforeStart("10:00", "09:00")).toBe(false);
  });
});
