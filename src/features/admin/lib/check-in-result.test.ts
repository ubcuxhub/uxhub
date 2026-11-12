import { describe, expect, it } from "vitest";

import { describeCheckInResult } from "./check-in-result";

// July, so the expected Vancouver time is PDT (UTC-7).
const CHECKED_IN_AT = "2026-07-15T17:02:00Z";

describe("describeCheckInResult", () => {
  it("names the person a check-in let in", () => {
    expect(
      describeCheckInResult({
        status: "checked_in",
        name: "Ada Lovelace",
        checkedInAt: CHECKED_IN_AT,
      }),
    ).toEqual({ title: "Ada Lovelace", detail: "Checked in" });
  });

  it("gives the first check-in time, in Vancouver, on a second scan", () => {
    expect(
      describeCheckInResult({
        status: "already_checked_in",
        name: "Ada Lovelace",
        checkedInAt: CHECKED_IN_AT,
      }),
    ).toEqual({
      title: "Ada Lovelace",
      detail: "Already checked in at 10:02 AM",
    });
  });

  it.each([
    ["invalid_code", "Not a UX Hub ticket"],
    ["not_found", "Ticket not found"],
    ["wrong_event", "Ticket is for a different event"],
  ] as const)("explains a %s rejection", (reason, title) => {
    expect(describeCheckInResult({ status: "rejected", reason }).title).toBe(title);
  });
});
