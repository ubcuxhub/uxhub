import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects slugs, empty strings, and malformed UUIDs", () => {
    expect(isUuid("uxathon-2026")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-42661417400")).toBe(false);
    expect(isUuid("123e4567e89b12d3a456426614174000")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000x")).toBe(false);
    expect(isUuid("\n123e4567-e89b-12d3-a456-426614174000")).toBe(false);
  });
});
