import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  fetchSetupStepByAuthId: vi.fn(),
}));

vi.mock("@/lib/log", () => ({ log: { warn: vi.fn(), error: vi.fn() }, errorFields: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase-helpers/admin-user-profile", () => ({ replaceProfilePhoto: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase-helpers/setup", () => ({
  fetchSetupStepByAuthId: mocks.fetchSetupStepByAuthId,
  fetchUserSetup: vi.fn(),
  updateUserSetup: vi.fn(),
}));

import { resolvePostSignInPath } from "./actions";

describe("resolvePostSignInPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
    mocks.fetchSetupStepByAuthId.mockResolvedValue("done");
  });

  it("sends an unfinished member to setup when heading for the portal home", async () => {
    mocks.fetchSetupStepByAuthId.mockResolvedValue("dietary");
    expect(await resolvePostSignInPath("/portal")).toBe("/portal/setup");
  });

  it("honours other destinations and finished members", async () => {
    mocks.fetchSetupStepByAuthId.mockResolvedValue("dietary");
    expect(await resolvePostSignInPath("/portal/events/x")).toBe("/portal/events/x");
    mocks.fetchSetupStepByAuthId.mockResolvedValue("done");
    expect(await resolvePostSignInPath("/portal")).toBe("/portal");
  });

  it("replaces an unsafe path with the portal home before applying the gate", async () => {
    mocks.fetchSetupStepByAuthId.mockResolvedValue("dietary");
    expect(await resolvePostSignInPath("https://evil.example/x")).toBe("/portal/setup");
    expect(await resolvePostSignInPath("//evil.example")).toBe("/portal/setup");
  });

  it("returns the safe path without a session or when the lookup fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await resolvePostSignInPath("/portal")).toBe("/portal");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
    mocks.fetchSetupStepByAuthId.mockRejectedValue(new Error("boom"));
    expect(await resolvePostSignInPath("/portal")).toBe("/portal");
  });
});
