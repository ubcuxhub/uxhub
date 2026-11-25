import { describe, expect, it } from "vitest";

import {
  formatUserName,
  getPartialUserNameFromMetadata,
  splitUserName,
} from "./user-name";

describe("user names", () => {
  it("formats first and last names with normalized outer whitespace", () => {
    expect(
      formatUserName({ first_name: "  Ada ", last_name: " Lovelace  " })
    ).toBe("Ada Lovelace");
  });

  it("formats a member with one name without a trailing space", () => {
    expect(formatUserName({ first_name: "Prince", last_name: "" })).toBe(
      "Prince"
    );
    expect(formatUserName({ first_name: "Prince", last_name: "  " })).toBe(
      "Prince"
    );
  });

  it("splits a full name at the first whitespace boundary", () => {
    expect(splitUserName("  Ada   Byron Lovelace ")).toEqual({
      first_name: "Ada",
      last_name: "Byron Lovelace",
    });
  });

  it.each(["", " ", "Ada"])("doesn't split a name without two parts: %j", (name) => {
    expect(splitUserName(name)).toBeNull();
  });

  it("reads first and last names written by password signup", () => {
    expect(
      getPartialUserNameFromMetadata({
        first_name: "Ada",
        last_name: "Lovelace",
        full_name: "Ignored Name",
      })
    ).toEqual({ first_name: "Ada", last_name: "Lovelace" });
  });

  it("reads a password signup with no last name", () => {
    expect(
      getPartialUserNameFromMetadata({ first_name: "Prince", last_name: "" })
    ).toEqual({ first_name: "Prince", last_name: "" });
  });

  it("reads standard OAuth given and family name metadata", () => {
    expect(
      getPartialUserNameFromMetadata({
        given_name: "Grace",
        family_name: "Hopper",
      })
    ).toEqual({ first_name: "Grace", last_name: "Hopper" });
  });

  it("falls back to splitting provider-supplied full_name metadata", () => {
    expect(
      getPartialUserNameFromMetadata({ full_name: "Alan Mathison Turing" })
    ).toEqual({ first_name: "Alan", last_name: "Mathison Turing" });
    expect(
      getPartialUserNameFromMetadata({ given_name: "Grace", name: "Grace Hopper" })
    ).toEqual({ first_name: "Grace", last_name: "Hopper" });
  });

  it("reads a one-word provider name as a first name alone", () => {
    expect(getPartialUserNameFromMetadata({ given_name: "Prince" })).toEqual({
      first_name: "Prince",
      last_name: "",
    });
    expect(getPartialUserNameFromMetadata({ name: "Prince" })).toEqual({
      first_name: "Prince",
      last_name: "",
    });
    expect(
      getPartialUserNameFromMetadata({ given_name: "Grace", name: "Grace" })
    ).toEqual({ first_name: "Grace", last_name: "" });
  });

  it("keeps a last name without a first for the add-your-name form", () => {
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
