import { describe, expect, it } from "vitest";

import {
  buildApplicationDecisionUpdate,
  countReviewStates,
  filterReviewItems,
  getApplicationDecisions,
  getApplicationReviewState,
  getReviewNeighbours,
  parseReviewListQuery,
  reviewScopeLabel,
  serializeReviewListQuery,
  type ReviewListItem,
} from "./application-review";

const now = new Date("2026-10-20T12:00:00.000Z");

describe("getApplicationReviewState", () => {
  it("shows undecided and final statuses as they are", () => {
    for (const status of ["submitted", "waitlisted", "rejected"] as const) {
      expect(
        getApplicationReviewState({ status, offer_expires_at: null }, false, now)
      ).toBe(status);
    }
  });

  it("splits an acceptance by its ticket and deadline", () => {
    const open = { status: "accepted" as const, offer_expires_at: "2026-10-21T00:00:00.000Z" };
    const lapsed = { status: "accepted" as const, offer_expires_at: "2026-10-20T11:59:59.000Z" };

    expect(getApplicationReviewState(open, false, now)).toBe("accepted");
    expect(getApplicationReviewState(lapsed, false, now)).toBe("offer_expired");
    expect(getApplicationReviewState(lapsed, true, now)).toBe("registered");
  });
});

describe("getApplicationDecisions", () => {
  it("follows the moves the database allows", () => {
    expect(getApplicationDecisions("submitted")).toEqual(["accept", "waitlist", "reject"]);
    expect(getApplicationDecisions("waitlisted")).toEqual(["accept", "reject"]);
    expect(getApplicationDecisions("offer_expired")).toEqual(["accept", "reject"]);
    expect(getApplicationDecisions("registered")).toEqual([]);
    expect(getApplicationDecisions("rejected")).toEqual([]);
  });
});

describe("buildApplicationDecisionUpdate", () => {
  it("requires a future deadline to accept", () => {
    expect(buildApplicationDecisionUpdate("accept", null, now).ok).toBe(false);
    expect(buildApplicationDecisionUpdate("accept", "2026-10-21T00:00", now).ok).toBe(false);
    expect(
      buildApplicationDecisionUpdate("accept", "2026-10-20T11:00:00.000Z", now).ok
    ).toBe(false);
    expect(
      buildApplicationDecisionUpdate("accept", "2026-10-21T00:00:00.000Z", now)
    ).toEqual({
      ok: true,
      update: { status: "accepted", offer_expires_at: "2026-10-21T00:00:00.000Z" },
    });
  });

  it("clears the deadline for any other decision", () => {
    expect(
      buildApplicationDecisionUpdate("reject", "2026-10-21T00:00:00.000Z", now)
    ).toEqual({ ok: true, update: { status: "rejected", offer_expires_at: null } });
    expect(buildApplicationDecisionUpdate("waitlist", null, now)).toEqual({
      ok: true,
      update: { status: "waitlisted", offer_expires_at: null },
    });
  });

  it("rejects an unknown decision", () => {
    expect(
      buildApplicationDecisionUpdate("approve" as never, null, now).ok
    ).toBe(false);
  });
});

function item(id: string, name: string, day: number, state: ReviewListItem["state"]): ReviewListItem {
  return {
    applicationId: id,
    name,
    email: `${name.split(" ")[0].toLowerCase()}@example.com`,
    program: null,
    appliedAt: `2026-10-${String(day).padStart(2, "0")}T18:00:00Z`,
    state,
    offerExpiresAt: null,
  };
}

const items = [
  item("a", "Cleo Park", 3, "submitted"),
  item("b", "Abe Lin", 1, "submitted"),
  item("c", "Bo Chen", 2, "waitlisted"),
  item("d", "Dee Ray", 4, "submitted"),
  item("e", "Eli Kim", 5, "rejected"),
];

describe("review list query", () => {
  it("selects Submitted when there is no status", () => {
    expect(parseReviewListQuery(new URLSearchParams(""))).toEqual({
      statuses: ["submitted"],
      sort: "oldest",
      q: "",
      page: 1,
    });
  });

  it("round-trips a view and leaves defaults out of the URL", () => {
    const query = parseReviewListQuery(
      new URLSearchParams("status=accepted,waitlisted&sort=name&q=ana&page=3")
    );
    // Statuses come back in queue order, whatever order the URL had.
    expect(query.statuses).toEqual(["waitlisted", "accepted"]);
    expect(serializeReviewListQuery(query)).toBe(
      "?status=waitlisted%2Caccepted&sort=name&q=ana&page=3"
    );
    expect(serializeReviewListQuery(parseReviewListQuery(new URLSearchParams("")))).toBe("");
  });

  it("writes every status as status=all, and reads it back", () => {
    const query = parseReviewListQuery(new URLSearchParams("status=all"));
    expect(query.statuses).toEqual([]);
    expect(serializeReviewListQuery(query)).toBe("?status=all");
  });

  it("ignores junk", () => {
    const query = parseReviewListQuery(
      new URLSearchParams("status=bogus&sort=sideways&page=-4")
    );
    expect(query).toMatchObject({ statuses: [], sort: "oldest", page: 1 });
  });
});

describe("filterReviewItems", () => {
  const view = { statuses: [], sort: "oldest" as const, q: "" };
  const ids = (list: ReviewListItem[]) => list.map((i) => i.applicationId);

  it("sorts oldest first, newest first and by name", () => {
    expect(ids(filterReviewItems(items, view))).toEqual(["b", "c", "a", "d", "e"]);
    expect(ids(filterReviewItems(items, { ...view, sort: "newest" }))).toEqual(["e", "d", "a", "c", "b"]);
    expect(filterReviewItems(items, { ...view, sort: "name" }).map((i) => i.name)).toEqual([
      "Abe Lin", "Bo Chen", "Cleo Park", "Dee Ray", "Eli Kim",
    ]);
  });

  it("filters by status and by name or email", () => {
    expect(ids(filterReviewItems(items, { ...view, statuses: ["submitted"] }))).toEqual(["b", "a", "d"]);
    expect(ids(filterReviewItems(items, { ...view, q: " CHEN " }))).toEqual(["c"]);
    expect(ids(filterReviewItems(items, { ...view, q: "dee@" }))).toEqual(["d"]);
  });

  it("counts every state", () => {
    expect(countReviewStates(items)).toMatchObject({ submitted: 3, waitlisted: 1, rejected: 1, accepted: 0 });
  });
});

describe("getReviewNeighbours", () => {
  const view = { statuses: ["submitted" as const], sort: "oldest" as const, q: "" };

  it("places an applicant in the filtered, sorted list", () => {
    expect(getReviewNeighbours(items, view, "a")).toMatchObject({
      position: 2,
      total: 3,
      previous: { applicationId: "b" },
      next: { applicationId: "d" },
      page: 1,
    });
  });

  it("has no previous at the start and no next at the end", () => {
    expect(getReviewNeighbours(items, view, "b")?.previous).toBeNull();
    expect(getReviewNeighbours(items, view, "d")?.next).toBeNull();
  });

  it("holds an applicant in place after a decision moves them out of the filter", () => {
    const decided = items.map((i) => (i.applicationId === "a" ? { ...i, state: "accepted" as const } : i));
    expect(getReviewNeighbours(decided, view, "a")).toMatchObject({
      position: 2,
      total: 3,
      previous: { applicationId: "b" },
      next: { applicationId: "d" },
      page: null,
    });
  });

  it("reports the list page the applicant is on", () => {
    const many = Array.from({ length: 30 }, (_, n) => item(`x${n}`, `Person ${n}`, 1 + (n % 28), "submitted"));
    const order = filterReviewItems(many, view);
    expect(getReviewNeighbours(many, view, order[24].applicationId)?.page).toBe(1);
    expect(getReviewNeighbours(many, view, order[25].applicationId)?.page).toBe(2);
  });

  it("is null for an applicant not on the event", () => {
    expect(getReviewNeighbours(items, view, "zzz")).toBeNull();
  });
});

describe("reviewScopeLabel", () => {
  it("names the list the pager counts", () => {
    expect(reviewScopeLabel({ statuses: ["submitted"], q: "" })).toBe("Submitted");
    expect(reviewScopeLabel({ statuses: ["registered"], q: "" })).toBe("Going");
    expect(reviewScopeLabel({ statuses: [], q: "" })).toBe("All applicants");
    expect(reviewScopeLabel({ statuses: ["submitted", "waitlisted"], q: "" })).toBe("Filtered list");
    expect(reviewScopeLabel({ statuses: ["submitted"], q: "ana" })).toBe("Filtered list");
  });
});
