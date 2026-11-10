import { describe, expect, it } from "vitest";

import {
  extractUbcCodeDigits,
  hasPurchaseUbcVerification,
  normalizeUbcCodeInput,
  ubcVerificationStatus,
  validateUbcEmail,
  type UbcVerificationUser,
} from "./ubc-verification";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

describe("validateUbcEmail", () => {
  it("accepts students only on student.ubc.ca", () => {
    expect(validateUbcEmail("jane@student.ubc.ca", "student")).toBeNull();
    for (const email of ["jane@ubc.ca", "jane@cs.ubc.ca", "jane@x.student.ubc.ca", "jane@alumni.ubc.ca"]) {
      expect(validateUbcEmail(email, "student")).toBe(
        "Use your UBC student email, ending in @student.ubc.ca.",
      );
    }
  });

  it("accepts faculty on ubc.ca and its department subdomains", () => {
    for (const email of ["prof@ubc.ca", "prof@cs.ubc.ca", "prof@sauder.ubc.ca", "prof@a.b.ubc.ca"]) {
      expect(validateUbcEmail(email, "faculty")).toBeNull();
    }
  });

  it("rejects student and alumni addresses for faculty", () => {
    for (const email of ["prof@student.ubc.ca", "prof@alumni.ubc.ca", "prof@x.student.ubc.ca", "prof@x.alumni.ubc.ca"]) {
      expect(validateUbcEmail(email, "faculty")).toBe(
        "Use your UBC faculty or staff email, not a student or alumni one.",
      );
    }
  });

  it("rejects lookalike domains", () => {
    for (const email of ["prof@ubc.ca.evil.com", "prof@evilubc.ca", "prof@ubc.ca@evil.com", "ubc.ca", "@ubc.ca", "pr of@ubc.ca"]) {
      expect(validateUbcEmail(email, "faculty")).not.toBeNull();
      expect(validateUbcEmail(email, "student")).not.toBeNull();
    }
    expect(validateUbcEmail("jane@student.ubc.ca.evil.com", "student")).not.toBeNull();
  });

  it("normalizes case and whitespace", () => {
    expect(validateUbcEmail("  Jane@Student.UBC.ca ", "student")).toBeNull();
    expect(validateUbcEmail(" PROF@CS.UBC.CA", "faculty")).toBeNull();
  });

  it("asks for an address when empty", () => {
    expect(validateUbcEmail(" ", "student")).toBe("Enter your UBC student email.");
    expect(validateUbcEmail("", "faculty")).toBe("Enter your UBC faculty or staff email.");
  });
});

function member(overrides: Partial<UbcVerificationUser> = {}): UbcVerificationUser {
  return {
    user_type: "ubcStudent",
    ubc_email: "jane@student.ubc.ca",
    ubc_verified_at: daysAgo(10),
    ubc_verified_via: "code",
    membership_type_id: null,
    membership_expires_at: null,
    membership_pre_ordered_type_id: null,
    ...overrides,
  };
}

describe("ubcVerificationStatus", () => {
  it("counts code, sign-in and manual stamps for 365 days", () => {
    for (const via of ["code", "sign_in_email", "manual"] as const) {
      expect(
        ubcVerificationStatus(member({ ubc_verified_via: via, ubc_verified_at: daysAgo(364) }), { now: NOW, termEndsAt: null }),
      ).toMatchObject({ state: "verified", via });
      expect(
        ubcVerificationStatus(member({ ubc_verified_via: via, ubc_verified_at: daysAgo(365) }), { now: NOW, termEndsAt: null }),
      ).toMatchObject({ state: "expired", via });
    }
  });

  it("keeps a grandfathered stamp while the membership lasts, and expires it after", () => {
    const grandfathered = { ubc_verified_via: "grandfathered" as const, ubc_verified_at: daysAgo(400), ubc_email: null };
    const active = member({ ...grandfathered, membership_type_id: "tier", membership_expires_at: "2099-01-01T00:00:00Z" });
    expect(ubcVerificationStatus(active, { now: NOW, termEndsAt: null }).state).toBe("verified");
    // The club-wide term end cuts it short like the membership itself.
    expect(ubcVerificationStatus(active, { now: NOW, termEndsAt: "2020-01-01T00:00:00Z" }).state).toBe("expired");
    const lapsed = member({ ...grandfathered, membership_type_id: "tier", membership_expires_at: "2020-01-01T00:00:00Z" });
    expect(ubcVerificationStatus(lapsed, { now: NOW, termEndsAt: null }).state).toBe("expired");
    const pending = member({ ...grandfathered, membership_pre_ordered_type_id: "tier" });
    expect(ubcVerificationStatus(pending, { now: NOW, termEndsAt: null }).state).toBe("verified");
  });

  it("reads unverified and n/a", () => {
    expect(ubcVerificationStatus(member({ ubc_verified_at: null, ubc_verified_via: null }), { now: NOW, termEndsAt: null })).toEqual({ state: "unverified" });
    expect(ubcVerificationStatus(member({ user_type: "nonUbc" }), { now: NOW, termEndsAt: null })).toEqual({ state: "n/a" });
  });
});

describe("hasPurchaseUbcVerification", () => {
  it("needs nothing from Non-UBC members", () => {
    expect(hasPurchaseUbcVerification(member({ user_type: "nonUbc", ubc_verified_at: null, ubc_verified_via: null }), NOW)).toBe(true);
  });

  it("takes a code, sign-in or manual stamp under a year old", () => {
    for (const via of ["code", "sign_in_email", "manual"] as const) {
      expect(hasPurchaseUbcVerification(member({ ubc_verified_via: via }), NOW)).toBe(true);
      expect(hasPurchaseUbcVerification(member({ ubc_verified_via: via, ubc_verified_at: daysAgo(365) }), NOW)).toBe(false);
    }
  });

  it("never takes grandfathering, even while the membership lasts", () => {
    expect(
      hasPurchaseUbcVerification(
        member({ ubc_verified_via: "grandfathered", membership_type_id: "tier", membership_expires_at: "2099-01-01T00:00:00Z" }),
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses an unverified UBC member", () => {
    expect(hasPurchaseUbcVerification(member({ ubc_verified_at: null, ubc_verified_via: null }), NOW)).toBe(false);
    expect(hasPurchaseUbcVerification(member({ user_type: "faculty", ubc_verified_at: null, ubc_verified_via: null }), NOW)).toBe(false);
  });
});

describe("code input", () => {
  it("keeps only digits on the client, up to six", () => {
    expect(extractUbcCodeDigits("123 456")).toBe("123456");
    expect(extractUbcCodeDigits("Code: 123456")).toBe("123456");
    expect(extractUbcCodeDigits("1234567")).toBe("123456");
  });

  it("is stricter on the server: six digits after spaces and dashes", () => {
    expect(normalizeUbcCodeInput("123 456")).toBe("123456");
    expect(normalizeUbcCodeInput("123-456")).toBe("123456");
    expect(normalizeUbcCodeInput("Code: 123456")).toBeNull();
    expect(normalizeUbcCodeInput("12345")).toBeNull();
    expect(normalizeUbcCodeInput(123456)).toBeNull();
  });
});
