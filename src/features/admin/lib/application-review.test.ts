import { describe, expect, it } from "vitest";

import {
  buildApplicationDecisionUpdate,
  countReviewStates,
  decisionsReleased,
  defaultOfferDeadline,
  filterReviewItems,
  getApplicationDecisions,
  getApplicationReviewState,
  getReviewNeighbours,
  parseReviewListQuery,
  programOptions,
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

  it("lets any decision change before release, until the applicant registers", () => {
    expect(getApplicationDecisions("accepted", false)).toEqual(["accept", "waitlist", "reject"]);
    expect(getApplicationDecisions("rejected", false)).toEqual(["accept", "waitlist"]);
    expect(getApplicationDecisions("waitlisted", false)).toEqual(["accept", "reject"]);
    expect(getApplicationDecisions("registered", false)).toEqual([]);
  });
});

describe("decisionsReleased", () => {
  it("is true with no release or once it has passed", () => {
    expect(decisionsReleased(null, now)).toBe(true);
    expect(decisionsReleased("2026-10-20T12:00:00.000Z", now)).toBe(true);
    expect(decisionsReleased("2026-10-20T12:00:01.000Z", now)).toBe(false);
  });
});

describe("defaultOfferDeadline", () => {
  // 2026-10-20T12:00Z is 5:00 AM Pacific (PDT).
  it("is a week out at 11:45 PM Pacific without settings", () => {
    expect(defaultOfferDeadline(null, now)).toEqual({ date: "2026-10-27", time: "23:45" });
    expect(
      defaultOfferDeadline({ decisions_release_at: null, confirmation_deadline: null }, now)
    ).toEqual({ date: "2026-10-27", time: "23:45" });
  });

  it("uses Confirm by when it is after now and the release", () => {
    expect(
      defaultOfferDeadline(
        {
          decisions_release_at: "2026-10-22T16:00:00.000Z",
          confirmation_deadline: "2026-10-25T06:59:00.000Z",
        },
        now
      )
    ).toEqual({ date: "2026-10-24", time: "23:59" });
  });

  it("counts the week from the release when Confirm by has passed or comes first", () => {
    // Release Oct 22, 9:00 AM Pacific; Confirm by already passed.
    expect(
      defaultOfferDeadline(
        {
          decisions_release_at: "2026-10-22T16:00:00.000Z",
          confirmation_deadline: "2026-10-19T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ date: "2026-10-29", time: "23:45" });
    // Confirm by equal to the release isn't after it.
    expect(
      defaultOfferDeadline(
        {
          decisions_release_at: "2026-10-22T16:00:00.000Z",
          confirmation_deadline: "2026-10-22T16:00:00.000Z",
        },
        now
      )
    ).toEqual({ date: "2026-10-29", time: "23:45" });
  });

  it("counts from now once the release has passed", () => {
    expect(
      defaultOfferDeadline(
        { decisions_release_at: "2026-10-01T16:00:00.000Z", confirmation_deadline: null },
        now
      )
    ).toEqual({ date: "2026-10-27", time: "23:45" });
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

function item(
  id: string,
  name: string,
  day: number,
  state: ReviewListItem["state"],
  profile: Partial<Pick<ReviewListItem, "program" | "year" | "studentStatus" | "membership">> = {}
): ReviewListItem {
  return {
    applicationId: id,
    name,
    email: `${name.split(" ")[0].toLowerCase()}@example.com`,
    program: null,
    year: null,
    studentStatus: null,
    membership: null,
    ...profile,
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
      memberships: [],
      years: [],
      studentStatuses: [],
      programs: [],
    });
  });

  it("keeps reading the sorts older links wrote", () => {
    for (const sort of ["oldest", "newest", "name"] as const) {
      expect(parseReviewListQuery(new URLSearchParams(`sort=${sort}`)).sort).toBe(sort);
    }
    const desc = parseReviewListQuery(new URLSearchParams("sort=name-desc"));
    expect(desc.sort).toBe("name-desc");
    expect(serializeReviewListQuery(desc)).toBe("?sort=name-desc");
  });

  it("round-trips the panel's filters, a program with a comma included", () => {
    const query = parseReviewListQuery(
      new URLSearchParams(
        "membership=explorer,none&year=4,3,9&student=graduate,alien&program=design&program=arts%2C%20media"
      )
    );
    expect(query).toMatchObject({
      memberships: ["explorer", "none"],
      // Known values only, in their own order.
      years: ["3", "4"],
      studentStatuses: ["graduate"],
      programs: ["design", "arts, media"],
    });
    expect(parseReviewListQuery(new URLSearchParams(serializeReviewListQuery(query)))).toEqual(query);
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

  it("sorts by name, Z to A", () => {
    expect(filterReviewItems(items, { ...view, sort: "name-desc" }).map((i) => i.name)).toEqual([
      "Eli Kim", "Dee Ray", "Cleo Park", "Bo Chen", "Abe Lin",
    ]);
  });

  it("filters by membership, year, student status and program, any within one, all across", () => {
    const people = [
      item("m1", "Ana", 1, "submitted", { membership: "explorer", year: "3", studentStatus: "undergraduate", program: "Design" }),
      item("m2", "Ben", 2, "submitted", { membership: "innovator", year: "4", studentStatus: "graduate", program: " design " }),
      item("m3", "Cy", 3, "submitted", { year: "3", program: "Commerce" }),
      item("m4", "Di", 4, "submitted"),
    ];
    const on = (filters: object) => ids(filterReviewItems(people, { ...view, ...filters }));

    expect(on({ memberships: ["none"] })).toEqual(["m3", "m4"]);
    expect(on({ memberships: ["explorer", "innovator"] })).toEqual(["m1", "m2"]);
    expect(on({ years: ["3"] })).toEqual(["m1", "m3"]);
    expect(on({ studentStatuses: ["graduate"] })).toEqual(["m2"]);
    expect(on({ programs: ["design"] })).toEqual(["m1", "m2"]);
    expect(on({ years: ["3"], memberships: ["none"] })).toEqual(["m3"]);
    // Missing values match no specific option.
    expect(on({ years: ["1", "2", "3", "4", "5+"] })).toEqual(["m1", "m2", "m3"]);
  });

  it("folds programs past the listed ones, and none, into Other", () => {
    const people = [
      item("p1", "A", 1, "submitted", { program: "Design" }),
      item("p2", "B", 2, "submitted", { program: "design" }),
      item("p3", "C", 3, "submitted", { program: "Commerce" }),
      item("p4", "D", 4, "submitted", { program: "Arts" }),
      item("p5", "E", 5, "submitted", { program: "other" }),
      item("p6", "F", 6, "submitted"),
    ];
    expect(programOptions(people, 2)).toEqual([
      { value: "design", label: "Design" },
      { value: "arts", label: "Arts" },
      { value: "other", label: "Other" },
    ]);
    // The default limit lists every program here; Other holds "other" and none.
    expect(ids(filterReviewItems(people, { ...view, programs: ["other"] }))).toEqual(["p5", "p6"]);
    expect(ids(filterReviewItems(people, { ...view, programs: ["commerce"] }))).toEqual(["p3"]);
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

  it("walks the list the panel's filters leave, as the table does", () => {
    const people = items.map((i) =>
      i.applicationId === "b" || i.applicationId === "d" ? { ...i, year: "4" as const } : i
    );
    const filtered = { ...view, years: ["4" as const] };
    expect(filterReviewItems(people, filtered).map((i) => i.applicationId)).toEqual(["b", "d"]);
    expect(getReviewNeighbours(people, filtered, "b")).toMatchObject({
      position: 1,
      total: 2,
      previous: null,
      next: { applicationId: "d" },
    });
    expect(reviewScopeLabel(filtered)).toBe("Filtered list");
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
