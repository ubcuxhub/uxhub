import { describe, expect, it } from "vitest";

import { hasAdminAccess, hasManagerAccess } from "./roles";

describe("role access", () => {
  it.each([
    ["basic", false, false],
    ["admin", true, false],
    ["manager", true, true],
    [null, false, false],
    [undefined, false, false],
  ] as const)(
    "maps %s to admin=%s and manager=%s",
    (role, expectedAdmin, expectedManager) => {
      expect(hasAdminAccess(role)).toBe(expectedAdmin);
      expect(hasManagerAccess(role)).toBe(expectedManager);
    }
  );
});
