import { describe, expect, it } from "vitest";

import { getSafeInternalPath, withReturnTo } from "./paths";

describe("auth paths", () => {
  describe("getSafeInternalPath", () => {
    it.each([
      ["/portal", "/portal"],
      ["/portal/events?filter=upcoming#tickets", "/portal/events?filter=upcoming#tickets"],
      ["/", "/"],
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
});
