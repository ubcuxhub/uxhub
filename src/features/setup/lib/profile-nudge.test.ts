import { describe, expect, it } from "vitest";

import { shouldShowProfileNudge } from "./profile-nudge";

describe("shouldShowProfileNudge", () => {
  it("shows for a finished member with no interests", () => {
    expect(shouldShowProfileNudge({ setup_step: "done", interests: [] }, false)).toBe(true);
  });

  it("hides once interests are saved", () => {
    expect(shouldShowProfileNudge({ setup_step: "done", interests: ["design"] }, false)).toBe(false);
  });

  it("hides when dismissed", () => {
    expect(shouldShowProfileNudge({ setup_step: "done", interests: [] }, true)).toBe(false);
  });

  it("hides while setup is unfinished", () => {
    expect(shouldShowProfileNudge({ setup_step: "about", interests: [] }, false)).toBe(false);
  });
});
