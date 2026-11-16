import { describe, expect, it } from "vitest";

import type { RoleAccess } from "@/lib/supabase/models";

import { isDraftEvent, portalEventStatuses, showsDraftEventsNote } from "./event-visibility";

const STAFF: RoleAccess[] = ["admin", "manager"];
const NON_STAFF: (RoleAccess | null | undefined)[] = ["basic", null, undefined];

describe("portalEventStatuses", () => {
  it.each(STAFF)("lists active and draft events to a %s", (role) => {
    expect(portalEventStatuses(role)).toEqual(["active", "draft"]);
  });

  it.each(NON_STAFF)("lists only active events to %s", (role) => {
    expect(portalEventStatuses(role)).toEqual(["active"]);
  });
});

describe("isDraftEvent", () => {
  it("is true for a draft only", () => {
    expect(isDraftEvent({ status: "draft" })).toBe(true);
    expect(isDraftEvent({ status: "active" })).toBe(false);
  });
});

describe("showsDraftEventsNote", () => {
  const withDraft = [{ status: "active" as const }, { status: "draft" as const }];
  const activeOnly = [{ status: "active" as const }];

  it.each(STAFF)("shows to a %s when the list holds a draft", (role) => {
    expect(showsDraftEventsNote(role, withDraft)).toBe(true);
  });

  it.each(STAFF)("hides from a %s when there are no drafts", (role) => {
    expect(showsDraftEventsNote(role, activeOnly)).toBe(false);
    expect(showsDraftEventsNote(role, [])).toBe(false);
  });

  it.each(NON_STAFF)("hides from %s, even given a draft", (role) => {
    expect(showsDraftEventsNote(role, withDraft)).toBe(false);
  });
});
