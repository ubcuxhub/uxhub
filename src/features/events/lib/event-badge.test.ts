import { describe, expect, it } from "vitest";

import { eventBadgeFor } from "./event-badge";
import type { EventState } from "./event-states";

describe("eventBadgeFor", () => {
  it.each<[EventState, ReturnType<typeof eventBadgeFor>]>([
    [{ kind: "reg-upcoming", opensAt: "2026-10-12T19:00:00Z" }, { status: "opens", date: "Oct 12" }],
    [{ kind: "app-upcoming", opensAt: "2026-10-12T19:00:00Z" }, { status: "opens", date: "Oct 12" }],
    [{ kind: "reg-open", closesAt: null }, { status: "registration_open" }],
    [{ kind: "reg-full" }, { status: "full" }],
    [{ kind: "reg-closed", closedAt: "2026-10-12T19:00:00Z" }, { status: "registration_closed" }],
    [{ kind: "reg-going", ticketId: "t" }, { status: "going" }],
    [
      { kind: "reg-checked-in", ticketId: "t", checkedInAt: "2026-10-12T19:00:00Z" },
      { status: "checked_in" },
    ],
    [{ kind: "reg-past" }, { status: "past" }],
    [{ kind: "reg-past-attended", ticketId: "t" }, { status: "past" }],
    [{ kind: "app-open", closesAt: null }, { status: "applications_open" }],
    [{ kind: "app-draft", closesAt: null }, { status: "draft" }],
    [{ kind: "app-in-review" }, { status: "pending" }],
    [{ kind: "app-waitlisted" }, { status: "waitlisted" }],
    // 06:59 UTC is still Oct 20 in Pacific time.
    [
      { kind: "app-accepted", offerExpiresAt: "2026-10-21T06:59:00Z" },
      { status: "register_by", date: "Oct 20" },
    ],
    [{ kind: "app-accepted", offerExpiresAt: null }, { status: "register_by", date: undefined }],
    [{ kind: "app-rejected" }, { status: "not_selected" }],
    [{ kind: "app-missed", closedAt: "2026-10-12T19:00:00Z" }, { status: "applications_closed" }],
    [{ kind: "app-draft-expired", closedAt: "2026-10-12T19:00:00Z" }, { status: "applications_closed" }],
    [{ kind: "app-offer-expired", offerExpiredAt: "2026-10-12T19:00:00Z", windowOpen: true }, { status: "applications_open" }],
    [{ kind: "app-offer-expired", offerExpiredAt: "2026-10-12T19:00:00Z", windowOpen: false }, { status: "applications_closed" }],
  ])("names %o", (state, badge) => {
    expect(eventBadgeFor(state)).toEqual(badge);
  });
});
