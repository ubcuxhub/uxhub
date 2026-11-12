import { describe, expect, it } from "vitest";

import { membershipLabel, membershipSummary, roleLabel } from "./model";

const member = {
  membership_type_id: "innovator",
  membership_pre_ordered_type_id: null,
  membership_expires_at: "2027-09-14T12:00:00-07:00",
};

describe("membershipSummary", () => {
  it("calls a pre-order pending, even without a membership", () => {
    const summary = membershipSummary(
      { ...member, membership_type_id: null, membership_pre_ordered_type_id: "explorer" },
      null,
      null,
    );
    expect(summary).toEqual({ kind: "pending" });
    expect(membershipLabel(summary)).toBe("Payment processing");
  });

  it("calls no membership not a member", () => {
    const summary = membershipSummary({ ...member, membership_type_id: null }, null, null);
    expect(membershipLabel(summary)).toBe("Not a member");
  });

  it("shows the effective end date, cut short by the club-wide term", () => {
    const summary = membershipSummary(member, "Innovator", "2027-08-31T23:59:00-07:00");
    expect(summary).toEqual({ kind: "active", name: "Innovator", expiresOn: "Aug 31, 2027" });
    expect(membershipLabel(summary)).toBe("Innovator member");
  });

  it("falls back to Member while the membership name is unknown", () => {
    expect(membershipLabel(membershipSummary(member, null, null))).toBe("Member");
  });
});

describe("roleLabel", () => {
  it("badges admins and managers only", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("basic")).toBeNull();
  });
});
