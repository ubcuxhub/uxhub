import { describe, expect, it } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";
import { mergeSavedUser, toUserRecord } from "./user-record";

const row = {
  id: "u1",
  first_name: "Dora",
  membership_type_id: "tier-1",
  order_date_deprecated: "2026-01-05",
} as unknown as UserInfoRow;

describe("toUserRecord", () => {
  it.each([
    ["an object", { name: "Innovator" }, "Innovator"],
    ["an array", [{ name: "Innovator" }], "Innovator"],
    ["an empty array", [], null],
    ["nothing", null, null],
  ])("reads the tier name from %s", (_, membership, expected) => {
    const record = toUserRecord({ ...row, membership_types: membership });
    expect(record.membership_type_name).toBe(expected);
    expect(record).not.toHaveProperty("membership_types");
  });

  it("exposes the deprecated order date as order_date", () => {
    expect(toUserRecord(row).order_date).toBe("2026-01-05");
  });
});

describe("mergeSavedUser", () => {
  const tiers = [{ id: "tier-2", name: "Explorer" }];
  const record = { ...row, membership_type_name: "Retired tier", order_date: null };

  it("keeps the tier name when the tier didn't change, even an inactive one", () => {
    const merged = mergeSavedUser(record, { ...row, first_name: "Dorothy" }, tiers);
    expect(merged).toMatchObject({ first_name: "Dorothy", membership_type_name: "Retired tier", order_date: "2026-01-05" });
  });

  it("looks up a new tier's name, or clears it", () => {
    expect(mergeSavedUser(record, { ...row, membership_type_id: "tier-2" }, tiers).membership_type_name).toBe("Explorer");
    expect(mergeSavedUser(record, { ...row, membership_type_id: null }, tiers).membership_type_name).toBeNull();
  });
});
