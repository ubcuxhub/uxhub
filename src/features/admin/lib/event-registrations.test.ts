import { describe, expect, it } from "vitest";

import { parseReviewListQuery } from "./application-review";
import { ACCEPTED_REVIEW_STATES, countCheckedInTickets, reviewListHref } from "./event-registrations";

const statuses = new Map<string, string | null>([
  ["t1_s1", "2026-11-20T02:00:00.000Z"],
  ["t1_s2", "2026-11-20T03:00:00.000Z"],
  ["t2_s1", null],
  ["t3_s1", "2026-11-20T02:00:00.000Z"],
]);

describe("countCheckedInTickets", () => {
  it("counts each checked-in ticket once", () => {
    expect(countCheckedInTickets(statuses)).toBe(2);
  });

  it("counts only the given holders", () => {
    expect(countCheckedInTickets(statuses, ["t1", "t2"])).toBe(1);
  });
});

describe("reviewListHref", () => {
  it("round-trips through the review list's own parser", () => {
    for (const states of [[], ["submitted"], ["rejected"], ACCEPTED_REVIEW_STATES] as const) {
      const href = reviewListHref("e1", states);
      expect(href.startsWith("/admin/events/e1/review-applications")).toBe(true);
      const query = parseReviewListQuery(new URL(href, "https://x").searchParams);
      expect(query.statuses).toEqual([...states]);
    }
  });
});
