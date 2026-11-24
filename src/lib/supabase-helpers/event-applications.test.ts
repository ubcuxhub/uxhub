import { describe, expect, it } from "vitest";

import { activeMembershipName } from "./event-applications";

const tier = { membership_types: { name: "explorer" } };
const future = "2999-01-01T00:00:00.000Z";
const past = "2000-01-01T00:00:00.000Z";

describe("activeMembershipName", () => {
  it("names an active member's tier", () => {
    expect(
      activeMembershipName(
        { membership_type_id: "t1", membership_expires_at: future, ...tier },
        null
      )
    ).toBe("explorer");
    // Embedded as a one-row array by some joins.
    expect(
      activeMembershipName(
        { membership_type_id: "t1", membership_expires_at: null, membership_types: [{ name: "innovator" }] },
        null
      )
    ).toBe("innovator");
  });

  it("treats an expired member as a non-member", () => {
    expect(
      activeMembershipName({ membership_type_id: "t1", membership_expires_at: past, ...tier }, null)
    ).toBeNull();
  });

  it("applies the club-wide term end", () => {
    expect(
      activeMembershipName({ membership_type_id: "t1", membership_expires_at: future, ...tier }, past)
    ).toBeNull();
  });

  it("is null without a tier", () => {
    expect(
      activeMembershipName({ membership_type_id: null, membership_expires_at: future, ...tier }, null)
    ).toBeNull();
  });
});
