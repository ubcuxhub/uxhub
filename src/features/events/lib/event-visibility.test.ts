import { describe, expect, it } from "vitest";

import type { RoleAccess } from "@/lib/supabase/models";

import {
  DRAFT_APPLICATION_UNLAUNCHED_REASON,
  DRAFT_REGISTRATION_UNLAUNCHED_REASON,
  PAID_DRAFT_REGISTRATION_REASON,
  draftRegistrationBlocks,
  draftTakesRegistrations,
  isDraftEvent,
  portalEventStatuses,
  showsDraftEventsNote,
} from "./event-visibility";

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

describe("draftTakesRegistrations", () => {
  it("is true for a free draft only, as event_ticket_eligibility allows", () => {
    expect(draftTakesRegistrations({ status: "draft", regular_price: 0, member_price: 0 })).toBe(true);
    expect(draftTakesRegistrations({ status: "draft", regular_price: 0, member_price: null })).toBe(true);
    expect(draftTakesRegistrations({ status: "draft", regular_price: 10, member_price: 0 })).toBe(false);
    expect(draftTakesRegistrations({ status: "draft", regular_price: 0, member_price: 5 })).toBe(false);
    expect(draftTakesRegistrations({ status: "active", regular_price: 0, member_price: 0 })).toBe(false);
  });
});

describe("draftRegistrationBlocks", () => {
  const free = { regular_price: 0, member_price: 0 };
  const paid = { regular_price: 10, member_price: 0 };

  it("blocks nothing on a published event", () => {
    expect(draftRegistrationBlocks({ status: "active", ...paid }, true)).toBeUndefined();
    expect(draftRegistrationBlocks({ status: "active", ...paid }, false)).toBeUndefined();
  });

  it("blocks nothing on a free draft", () => {
    expect(draftRegistrationBlocks({ status: "draft", ...free }, true)).toBeUndefined();
  });

  it("blocks registering, never applying, on a paid draft", () => {
    expect(draftRegistrationBlocks({ status: "draft", ...paid }, true)).toEqual({
      register: PAID_DRAFT_REGISTRATION_REASON,
    });
  });

  it("blocks both while student events are off", () => {
    expect(draftRegistrationBlocks({ status: "draft", ...free }, false)).toEqual({
      register: DRAFT_REGISTRATION_UNLAUNCHED_REASON,
      apply: DRAFT_APPLICATION_UNLAUNCHED_REASON,
    });
  });
});
