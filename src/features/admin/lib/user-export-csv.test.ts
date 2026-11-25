import { describe, expect, it } from "vitest";
import { serializeUserExport } from "./user-export-csv";
import type { UserExportRecord } from "@/lib/supabase-helpers/user-export";

const row: UserExportRecord = { name: "Renée 王", email: "a@example.test", role: "basic", membershipType: null, membershipExpiry: null, faculty: null, major: null, school: null, studyYear: null, createdAt: "2026-11-24T00:00:00Z" };

describe("user export CSV", () => {
  it("has exactly the approved ordered headers even without accounts", () => {
    expect(serializeUserExport([])).toBe('\ufeff"Name","Email","Role","Membership type","Membership expiry","Faculty","Major","School","Study year","Account creation date"\r\n');
  });
  it("preserves Unicode and ordinary values, quotes commas/newlines/quotes and renders nulls empty", () => {
    expect(serializeUserExport([{ ...row, major: 'Design, "UX"\nResearch' }]).split("\r\n")[1])
      .toBe('"Renée 王","a@example.test","basic","","","","Design, ""UX""\nResearch","","","2026-11-24T00:00:00Z"');
  });
  it.each(["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1", "\t=1", "\r=1", "\n=1", "\tplain", "\u0000=1"])("neutralizes formula/control prefix %j", (value) => {
    expect(serializeUserExport([{ ...row, name: value }]).split("\r\n")[1]).toContain(`"'${value}"`);
  });
  it("does not serialize unrelated properties", () => {
    expect(serializeUserExport([{ ...row, student_number: "private-secret" } as UserExportRecord])).not.toContain("private-secret");
  });
});
