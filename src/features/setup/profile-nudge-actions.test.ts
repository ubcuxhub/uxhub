import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

import { dismissProfileNudgeAction } from "./profile-nudge-actions";

describe("dismissProfileNudgeAction", () => {
  beforeEach(() => set.mockClear());

  it("sets a year-long, site-wide, Lax cookie", async () => {
    await dismissProfileNudgeAction();
    expect(set).toHaveBeenCalledWith("uxhub_profile_nudge_dismissed", "1", {
      maxAge: 31536000,
      sameSite: "lax",
      path: "/",
    });
  });
});
