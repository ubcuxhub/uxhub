import { describe, expect, it } from "vitest";

import type { UbcVerificationUser } from "@/features/memberships/lib/ubc-verification";
import { ubcVerificationFilterValue, ubcVerificationLine } from "./ubc-verification-display";

const NOW = new Date("2026-11-10T20:00:00.000Z");
const OCT_3 = "2026-10-03T19:00:00.000Z";

function member(overrides: Partial<UbcVerificationUser> = {}): UbcVerificationUser {
  return {
    user_type: "ubcStudent",
    ubc_email: "jane@student.ubc.ca",
    ubc_verified_at: OCT_3,
    ubc_verified_via: "code",
    membership_type_id: null,
    membership_expires_at: null,
    membership_pre_ordered_type_id: null,
    ...overrides,
  };
}

const line = (user: UbcVerificationUser, extra: { codeSentAt?: string } = {}) =>
  ubcVerificationLine({ user, termEndsAt: null, verifiedBy: "Iris Chan", now: NOW, ...extra });

describe("ubcVerificationLine", () => {
  it("names the method, the address and the date", () => {
    expect(line(member())).toBe("Verified by code · jane@student.ubc.ca · Oct 3, 2026");
    expect(line(member({ user_type: "faculty", ubc_email: "prof@ubc.ca", ubc_verified_via: "sign_in_email" }))).toBe(
      "Verified by sign-in email · prof@ubc.ca · Oct 3, 2026",
    );
    expect(line(member({ ubc_verified_via: "manual" }))).toBe("Verified manually · Oct 3, 2026 · by Iris Chan");
  });

  it("shows grandfathering while the membership runs, then expired", () => {
    const grandfathered = member({ ubc_verified_via: "grandfathered", ubc_email: null, membership_type_id: "tier" });
    expect(line(grandfathered)).toBe("Grandfathered · until membership ends");
    expect(line({ ...grandfathered, membership_expires_at: "2026-01-01T00:00:00Z" })).toBe(
      "Expired · grandfathered membership ended",
    );
  });

  it("dates an expired stamp by when it stopped counting", () => {
    expect(line(member({ ubc_verified_at: "2025-10-03T19:00:00.000Z" }))).toBe("Expired · Oct 3, 2026");
  });

  it("tells a code waiting to be entered from no verification at all", () => {
    const unverified = member({ ubc_verified_at: null, ubc_verified_via: null });
    expect(line(unverified)).toBe("Not verified");
    expect(line(unverified, { codeSentAt: "2026-11-10T19:55:00.000Z" })).toBe("Code sent Nov 10, 2026 · not entered");
  });

  it("says Non-UBC members need none", () => {
    expect(line(member({ user_type: "nonUbc" }))).toBe("Not needed for Non-UBC members");
  });
});

describe("ubcVerificationFilterValue", () => {
  it("files each UBC member under one chip and leaves Non-UBC out", () => {
    expect(ubcVerificationFilterValue(member(), null, NOW)).toBe("verified");
    expect(ubcVerificationFilterValue(member({ ubc_verified_via: "grandfathered", membership_type_id: "tier" }), null, NOW)).toBe("grandfathered");
    expect(ubcVerificationFilterValue(member({ ubc_verified_at: "2025-01-01T00:00:00Z" }), null, NOW)).toBe("expired");
    expect(ubcVerificationFilterValue(member({ ubc_verified_at: null, ubc_verified_via: null }), null, NOW)).toBe("unverified");
    expect(ubcVerificationFilterValue(member({ user_type: "nonUbc" }), null, NOW)).toBeNull();
  });
});
