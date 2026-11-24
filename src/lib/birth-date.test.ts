import { afterEach, describe, expect, it, vi } from "vitest";

import {
  birthDateError,
  FUTURE_BIRTH_DATE,
  INCOMPLETE_BIRTH_DATE,
  INVALID_BIRTH_DATE,
  latestBirthDate,
  validateBirthDate,
} from "./birth-date";

afterEach(() => {
  vi.useRealTimers();
});

describe("validateBirthDate", () => {
  it("validates leap days without silently rolling to another date", () => {
    expect(validateBirthDate("2000-02-29")).toBe("2000-02-29");
    expect(() => validateBirthDate("2001-02-29")).toThrow("valid birth date");
    expect(() => validateBirthDate("2000-04-31")).toThrow("valid birth date");
    expect(() => validateBirthDate("0000-01-01")).toThrow("valid birth date");
  });

  it("clears on null or an empty input", () => {
    expect(validateBirthDate(null)).toBeNull();
    expect(validateBirthDate("")).toBeNull();
  });

  it("rejects future dates and unsupported date formats", () => {
    expect(() => validateBirthDate("2999-01-01")).toThrow("future");
    expect(() => validateBirthDate("01/01/2000")).toThrow("valid birth date");
    expect(() => validateBirthDate({})).toThrow("valid birth date");
    expect(() => validateBirthDate(undefined)).toThrow("valid birth date");
  });

  it("allows today, in UTC, and refuses tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T23:30:00-08:00"));
    expect(latestBirthDate()).toBe("2026-11-22");
    expect(validateBirthDate("2026-11-22")).toBe("2026-11-22");
    expect(() => validateBirthDate("2026-11-23")).toThrow(FUTURE_BIRTH_DATE);
  });
});

describe("birthDateError", () => {
  it("says what validateBirthDate would throw", () => {
    expect(birthDateError("")).toBeNull();
    expect(birthDateError("2000-02-29")).toBeNull();
    expect(birthDateError("2999-01-01")).toBe(FUTURE_BIRTH_DATE);
    expect(birthDateError("2001-02-29")).toBe(INVALID_BIRTH_DATE);
  });

  it("refuses a half-typed date instead of reading it as cleared", () => {
    expect(birthDateError(INCOMPLETE_BIRTH_DATE)).toBe(INVALID_BIRTH_DATE);
    expect(() => validateBirthDate(INCOMPLETE_BIRTH_DATE)).toThrow(INVALID_BIRTH_DATE);
  });
});
