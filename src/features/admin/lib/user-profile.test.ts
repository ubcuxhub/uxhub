import { describe, expect, it } from "vitest";
import { normalizeInterests, parseProfilePhoto, validateBirthDate } from "./user-profile";

describe("admin profile validation", () => {
  it("validates leap days without silently rolling to another date", () => {
    expect(validateBirthDate("2000-02-29")).toBe("2000-02-29");
    expect(() => validateBirthDate("2001-02-29")).toThrow("valid birth date");
    expect(() => validateBirthDate("2000-04-31")).toThrow("valid birth date");
    expect(() => validateBirthDate("0000-01-01")).toThrow("valid birth date");
    expect(validateBirthDate(null)).toBeNull();
  });

  it("rejects future dates and unsupported date formats", () => {
    expect(() => validateBirthDate("2999-01-01")).toThrow("future");
    expect(() => validateBirthDate("01/01/2000")).toThrow("valid birth date");
    expect(() => validateBirthDate({})).toThrow("valid birth date");
  });

  it("deduplicates tags while preserving the first spelling and rejects invalid tags", () => {
    expect(normalizeInterests([" Design ", "design", "RESEARCH"])).toEqual(["Design", "RESEARCH"]);
    expect(() => normalizeInterests([" "])).toThrow();
    expect(() => normalizeInterests(["x".repeat(51)])).toThrow();
    expect(() => normalizeInterests(Array.from({ length: 21 }, (_, i) => `tag ${i}`))).toThrow();
    expect(() => normalizeInterests([null])).toThrow();
  });

  it("accepts rectangular photo dimensions without changing event cover rules", () => {
    const png = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png);
    png.writeUInt32BE(120, 16); png.writeUInt32BE(240, 20);
    expect(parseProfilePhoto(png, "image/png")).toMatchObject({ extension: "png" });
    expect(() => parseProfilePhoto(png, "image/svg+xml")).toThrow();
    expect(() => parseProfilePhoto(Buffer.alloc(4194305), "image/png")).toThrow("4 MiB");
    expect(() => parseProfilePhoto(Buffer.from("invalid"), "image/png")).toThrow("valid JPEG or PNG");
    png.writeUInt32BE(0, 16);
    expect(() => parseProfilePhoto(png, "image/png")).toThrow();
  });
});
