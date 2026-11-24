import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  fetchSetupStepByAuthId: vi.fn(),
  requireAuth: vi.fn(),
  updateUserSetup: vi.fn(),
  supabaseAdmin: { role: "service" },
}));

vi.mock("@/lib/log", () => ({ log: { warn: vi.fn(), error: vi.fn() }, errorFields: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: mocks.supabaseAdmin }));
vi.mock("@/lib/supabase-helpers/admin-user-profile", () => ({ replaceProfilePhoto: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase-helpers/setup", () => ({
  fetchSetupStepByAuthId: mocks.fetchSetupStepByAuthId,
  fetchUserSetup: vi.fn(),
  updateUserSetup: mocks.updateUserSetup,
}));

import { resolvePostSignInPath, saveBirthDateAction } from "./actions";

const SAVED_ROW = {
  setup_step: "dietary",
  user_type: "ubcStudent",
  user_type_confirmed_at: null,
  diets: [],
  allergies: [],
  other_allergies: [],
  avatar_preset: null,
  profile_photo_path: null,
  interests: [],
  birth_date: "2000-02-29",
};

describe("saveBirthDateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: "member-1", setup_step: "dietary" });
    mocks.updateUserSetup.mockImplementation(async (_db, _id, patch) => ({ ...SAVED_ROW, ...patch }));
  });

  it("writes the signed-in member's own row with the service role, leaving the step alone", async () => {
    const saved = await saveBirthDateAction({ birthDate: "2000-02-29" });
    expect(mocks.updateUserSetup).toHaveBeenCalledWith(mocks.supabaseAdmin, "member-1", {
      birth_date: "2000-02-29",
    });
    expect(saved).toMatchObject({ birthDate: "2000-02-29", step: "dietary" });
  });

  it("clears on null or an empty input", async () => {
    await saveBirthDateAction({ birthDate: null });
    await saveBirthDateAction({ birthDate: "" });
    expect(mocks.updateUserSetup.mock.calls.map((call) => call[2])).toEqual([
      { birth_date: null },
      { birth_date: null },
    ]);
  });

  it("refuses future, impossible and missing dates without writing", async () => {
    await expect(saveBirthDateAction({ birthDate: "2999-01-01" })).rejects.toThrow(
      "Birth date cannot be in the future.",
    );
    await expect(saveBirthDateAction({ birthDate: "2001-02-29" })).rejects.toThrow(
      "Enter a valid birth date.",
    );
    await expect(saveBirthDateAction({} as never)).rejects.toThrow("Enter a valid birth date.");
    await expect(saveBirthDateAction(null as never)).rejects.toThrow("Enter a valid birth date.");
    expect(mocks.updateUserSetup).not.toHaveBeenCalled();
  });

  it("requires a session before anything else", async () => {
    mocks.requireAuth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveBirthDateAction({ birthDate: "2000-01-01" })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.updateUserSetup).not.toHaveBeenCalled();
  });
});

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
