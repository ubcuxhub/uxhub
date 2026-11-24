import { describe, expect, it } from "vitest";

import {
  completeProfilePath,
  getSafeInternalPath,
  withReturnTo,
} from "./paths";

describe("auth paths", () => {
  describe("getSafeInternalPath", () => {
    it.each([
      ["/portal", "/portal"],
      ["/portal/events?filter=upcoming#tickets", "/portal/events?filter=upcoming#tickets"],
      ["/", "/"],
      ["/portal/membership/join?returnTo=%2Fportal", "/portal/membership/join?returnTo=%2Fportal"],
      // Dot segments that stay on-site are normalised, not rejected.
      ["/portal/./events", "/portal/events"],
      ["/admin/events/../users", "/admin/users"],
      ["/portal/events/caf%C3%A9", "/portal/events/caf%C3%A9"],
      // A protocol-relative URL in the query string is just data.
      ["/auth/login?next=//evil.com", "/auth/login?next=//evil.com"],
    ])("keeps the internal path %j", (value, expected) => {
      expect(getSafeInternalPath(value)).toBe(expected);
    });

    it.each([
      [undefined],
      [null],
      [""],
      ["portal"],
      ["https://example.com"],
      ["//example.com"],
      ["///example.com"],
      ["/\\example.com"],
      ["\\example.com"],
      ["/\texample.com"],
      ["/\n/example.com"],
      ["/%5Cevil.com"],
      ["/%5cevil.com"],
      ["/%09/evil.com"],
      ["/%0a/evil.com"],
      ["/portal/%5Cevil.com"],
      ["https://evil.com"],
      ["//evil.com"],
      ["/\\evil.com"],
      // Dot segments that collapse into a protocol-relative path.
      ["/.//evil.com"],
      ["/..//evil.com"],
      ["/a/..//evil.com"],
      ["/portal/../..//evil.com"],
      ["/%2e//evil.com"],
      ["/%2E%2E//evil.com"],
      ["/.%2e//evil.com"],
      // Encoded slashes that become one after a single decode.
      ["/%2fevil.com"],
      ["/%2F%2Fevil.com"],
      ["/.%2f/evil.com"],
      ["/.//evil.com?next=/portal"],
      ["/.//evil.com#portal"],
      // Malformed percent-encoding.
      ["/%"],
      ["/portal/%E0%A4%A"],
    ])("rejects the unsafe destination %j", (value) => {
      expect(getSafeInternalPath(value)).toBe("/portal");
    });

    it("uses the supplied fallback for an unsafe destination", () => {
      expect(getSafeInternalPath("https://example.com", "/")).toBe("/");
    });
  });

  describe("withReturnTo", () => {
    it("encodes a validated return path", () => {
      expect(withReturnTo("/auth/login", "/portal/events?id=123")).toBe(
        "/auth/login?returnTo=%2Fportal%2Fevents%3Fid%3D123",
      );
    });

    it("replaces an unsafe return path with the portal", () => {
      expect(withReturnTo("/auth/login", "//example.com")).toBe(
        "/auth/login?returnTo=%2Fportal",
      );
    });
  });

  describe("completeProfilePath", () => {
    it("carries a safe next path to the add-your-name form", () => {
      expect(completeProfilePath("/portal/membership/join?tier=a")).toBe(
        "/auth/complete-profile?next=%2Fportal%2Fmembership%2Fjoin%3Ftier%3Da",
      );
    });

    it.each([null, undefined, "https://evil.example", "//evil.example"])(
      "falls back to the portal for %j",
      (next) => {
        expect(completeProfilePath(next)).toBe(
          "/auth/complete-profile?next=%2Fportal",
        );
      },
    );
  });
});
