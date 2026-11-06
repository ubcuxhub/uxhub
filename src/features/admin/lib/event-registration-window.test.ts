import { describe, expect, it } from "vitest";

import { registrationWindow } from "./event-registration-window";

const NOW = new Date("2026-11-05T20:00:00.000Z");
const BEFORE = "2026-11-01T20:00:00.000Z";
const AFTER = "2026-11-10T20:00:00.000Z";

function windowFor(status: "draft" | "active", opens: string | null, closes: string | null) {
  return registrationWindow(
    { status, registration_opens_at: opens, registration_closes_at: closes },
    NOW
  );
}

describe("registrationWindow", () => {
  it("has none for a draft", () => {
    expect(windowFor("draft", BEFORE, AFTER)).toBe("not-applicable");
  });

  it("is open between its bounds, and when they're unset", () => {
    expect(windowFor("active", BEFORE, AFTER)).toBe("open");
    expect(windowFor("active", null, null)).toBe("open");
    expect(windowFor("active", null, AFTER)).toBe("open");
  });

  it("is upcoming before it opens", () => {
    expect(windowFor("active", AFTER, null)).toBe("upcoming");
  });

  it("is closed after it closes", () => {
    expect(windowFor("active", null, BEFORE)).toBe("closed");
  });
});
