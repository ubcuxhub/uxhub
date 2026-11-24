import { describe, expect, it } from "vitest";

import {
  formatUserName,
  getPartialUserNameFromMetadata,
  getUserNameFromMetadata,
  splitUserName,
} from "./user-name";

describe("user names", () => {
  it("formats first and last names with normalized outer whitespace", () => {
    expect(
      formatUserName({ first_name: "  Ada ", last_name: " Lovelace  " })
    ).toBe("Ada Lovelace");
  });

  it("splits a full name at the first whitespace boundary", () => {
    expect(splitUserName("  Ada   Byron Lovelace ")).toEqual({
      first_name: "Ada",
      last_name: "Byron Lovelace",
    });
  });

  it.each(["", " ", "Ada"])("rejects an incomplete full name: %j", (name) => {
    expect(splitUserName(name)).toBeNull();
  });

  it("reads first and last names written by password signup", () => {
    expect(
      getUserNameFromMetadata({
        first_name: "Ada",
        last_name: "Lovelace",
        full_name: "Ignored Name",
      })
    ).toEqual({ first_name: "Ada", last_name: "Lovelace" });
  });

  it("reads standard OAuth given and family name metadata", () => {
    expect(
      getUserNameFromMetadata({
        given_name: "Grace",
        family_name: "Hopper",
      })
    ).toEqual({ first_name: "Grace", last_name: "Hopper" });
  });

  it("falls back to splitting provider-supplied full_name metadata", () => {
    expect(getUserNameFromMetadata({ full_name: "Alan Mathison Turing" })).toEqual(
      { first_name: "Alan", last_name: "Mathison Turing" }
    );
  });

  it("rejects metadata that cannot supply both required names", () => {
    expect(getUserNameFromMetadata({ given_name: "Prince" })).toBeNull();
  });

  it("rejects a one-word provider name", () => {
    expect(getUserNameFromMetadata({ name: "Prince" })).toBeNull();
  });

  it("keeps the names metadata does supply for the add-your-name form", () => {
    expect(getPartialUserNameFromMetadata({ name: "Prince" })).toEqual({
      first_name: "Prince",
      last_name: "",
    });
    expect(
      getPartialUserNameFromMetadata({ given_name: "Grace", name: "Grace" })
    ).toEqual({ first_name: "Grace", last_name: "" });
    expect(getPartialUserNameFromMetadata({ family_name: "Hopper" })).toEqual({
      first_name: "",
      last_name: "Hopper",
    });
    expect(getPartialUserNameFromMetadata({})).toEqual({
      first_name: "",
      last_name: "",
    });
  });
});
