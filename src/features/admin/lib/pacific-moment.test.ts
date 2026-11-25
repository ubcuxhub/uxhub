import { describe, expect, it } from "vitest";

import { momentEndsTooEarly, PACIFIC_MOMENT_ERROR, pacificMomentProblem } from "./pacific-moment";

describe("pacificMomentProblem", () => {
  it("accepts an empty or valid moment", () => {
    expect(pacificMomentProblem("")).toBeNull();
    expect(pacificMomentProblem("2026-11-19T18:00")).toBeNull();
  });

  it("names a half-filled moment with the caller's message", () => {
    expect(pacificMomentProblem("2026-11-19T", "Both halves.")).toBe("Both halves.");
    expect(pacificMomentProblem("T18:00", "Both halves.")).toBe("Both halves.");
  });

  it("refuses wall times a daylight-saving change repeats or skips, as the builder does", () => {
    // 1:30 happened twice on 2025-11-02, and 2:30 never on 2025-03-09, in Vancouver.
    expect(pacificMomentProblem("2025-11-02T01:30")).toBe(PACIFIC_MOMENT_ERROR);
    expect(pacificMomentProblem("2025-03-09T02:30")).toBe(PACIFIC_MOMENT_ERROR);
  });
});

describe("momentEndsTooEarly", () => {
  it("compares complete moments as instants", () => {
    expect(momentEndsTooEarly("2026-11-19T18:00", "2026-11-19T18:00")).toBe(true);
    expect(momentEndsTooEarly("2026-11-19T18:00", "2026-11-19T19:00")).toBe(false);
    expect(momentEndsTooEarly("2026-11-19T18:00", "")).toBe(false);
  });
});
