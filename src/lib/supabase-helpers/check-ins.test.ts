import { describe, expect, it } from "vitest";

import { attendeeName } from "./check-ins";

describe("attendeeName", () => {
  it("joins both names", () => {
    expect(attendeeName({ first_name: "Ada", last_name: "Lovelace" })).toBe("Ada Lovelace");
  });

  it("names a member with one name by it alone, with no trailing space", () => {
    expect(attendeeName({ first_name: "Prince", last_name: "" })).toBe("Prince");
  });

  it("falls back when there's no profile or no name", () => {
    expect(attendeeName(null)).toBe("Unknown User");
    expect(attendeeName({ first_name: null, last_name: null })).toBe("Unknown User");
  });
});
