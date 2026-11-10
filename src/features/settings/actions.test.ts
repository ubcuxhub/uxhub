import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deleteAccountAction, saveInterestsAction } from "./actions";

const requireAuth = vi.hoisted(() => vi.fn());
const adminDeleteAccount = vi.hoisted(() => vi.fn());
const fetchUserSetup = vi.hoisted(() => vi.fn());
const updateUserSetup = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase-helpers/setup", () => ({ fetchUserSetup, updateUserSetup }));

vi.mock("@/lib/auth/guards", () => ({
  requireAuth,
}));

vi.mock("@/lib/supabase-helpers/admin-server", () => ({
  adminDeleteAccount,
}));

describe("deleteAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({
      auth_user_id: "auth-user-1",
      email: "member@student.ubc.ca",
    });
    adminDeleteAccount.mockResolvedValue(undefined);
  });

  it("returns a stable failure when account deletion is rejected", async () => {
    adminDeleteAccount.mockRejectedValue(new Error("database details"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      deleteAccountAction("member@student.ubc.ca"),
    ).resolves.toEqual({
      ok: false,
      error: "Your account could not be deleted.",
    });
    expect(consoleError).toHaveBeenCalledOnce();

    // The database error's message can quote account data, so it must not
    // reach the log.
    const [line] = consoleError.mock.calls[0] as [string];
    expect(line).toContain("account.deletion_failed");
    expect(line).toContain("Error");
    expect(line).not.toContain("database details");

    consoleError.mockRestore();
  });

  it("preserves authentication redirects thrown by requireAuth", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    requireAuth.mockRejectedValue(redirectError);

    await expect(
      deleteAccountAction("member@student.ubc.ca"),
    ).rejects.toBe(redirectError);
    expect(adminDeleteAccount).not.toHaveBeenCalled();
  });
});

describe("saveInterestsAction", () => {
  const row = {
    setup_step: "done",
    diets: [],
    allergies: [],
    other_allergies: [],
    avatar_preset: null,
    profile_photo_path: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ id: "member-1", setup_step: "done" });
    fetchUserSetup.mockResolvedValue({ ...row, interests: ["Figma whiz", "workshops"] });
    updateUserSetup.mockImplementation(async (_db, _id, patch) => ({ ...row, ...patch }));
  });

  it("keeps managers' free tags and replaces the member's chips, without touching setup", async () => {
    const saved = await saveInterestsAction({ interests: ["uxathon", "mentorship"] });
    expect(updateUserSetup).toHaveBeenCalledWith({}, "member-1", {
      interests: ["Figma whiz", "uxathon", "mentorship"],
    });
    expect(saved).toMatchObject({ step: "done", interests: ["Figma whiz", "uxathon", "mentorship"] });
  });

  it("rejects ids outside the taxonomy before writing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(saveInterestsAction({ interests: ["Hacking" as never] })).rejects.toThrow(
      "Choose interests from the list.",
    );
    expect(updateUserSetup).not.toHaveBeenCalled();
  });
});
