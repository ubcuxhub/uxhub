import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateUbcCode, hashUbcCode, newUbcCodeSalt, ubcCodeHashesMatch } = await import("./ubc-code");

describe("ubc-code", () => {
  it("always makes six digits, zero-padded", () => {
    for (let i = 0; i < 500; i++) expect(generateUbcCode()).toMatch(/^\d{6}$/);
  });

  it("uses 16 fresh salt bytes per send", () => {
    const a = newUbcCodeSalt();
    expect(a).toHaveLength(16);
    expect(a.equals(newUbcCodeSalt())).toBe(false);
  });

  it("binds the hash to the member, the address and the salt", () => {
    const salt = Buffer.alloc(16, 1);
    const base = { code: "123456", email: "jane@student.ubc.ca", salt, userId: "user-1" };
    const hash = hashUbcCode(base);
    expect(hash).toHaveLength(32);
    expect(ubcCodeHashesMatch(hash, hashUbcCode(base))).toBe(true);
    expect(ubcCodeHashesMatch(hash, hashUbcCode({ ...base, code: "123457" }))).toBe(false);
    expect(ubcCodeHashesMatch(hash, hashUbcCode({ ...base, userId: "user-2" }))).toBe(false);
    expect(ubcCodeHashesMatch(hash, hashUbcCode({ ...base, email: "john@student.ubc.ca" }))).toBe(false);
    expect(ubcCodeHashesMatch(hash, hashUbcCode({ ...base, salt: Buffer.alloc(16, 2) }))).toBe(false);
  });

  it("rejects a hash of another length instead of throwing", () => {
    const hash = hashUbcCode({ code: "123456", email: "a@ubc.ca", salt: Buffer.alloc(16), userId: "u" });
    expect(ubcCodeHashesMatch(hash, hash.subarray(0, 31))).toBe(false);
    expect(ubcCodeHashesMatch(hash, Buffer.alloc(0))).toBe(false);
  });
});
