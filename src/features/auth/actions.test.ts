import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeProfileAction } from "./actions";

vi.mock("server-only", () => ({}));

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  ensureUserInfo: vi.fn(),
  fetchUserInfoByAuthId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("@/lib/auth/ensure-user-info", () => ({
  ensureUserInfo: profileMocks.ensureUserInfo,
}));

vi.mock("@/lib/supabase-helpers/users", () => ({
  fetchUserInfoByAuthId: profileMocks.fetchUserInfoByAuthId,
}));

const names = { firstName: "Ada", lastName: "Lovelace" };

describe("completeProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "student@example.com",
        },
      },
      error: null,
    });
    profileMocks.fetchUserInfoByAuthId.mockResolvedValue(null);
    profileMocks.ensureUserInfo.mockResolvedValue({ status: "ok" });
  });

  it("succeeds without writing when a prior call already completed the profile", async () => {
    profileMocks.fetchUserInfoByAuthId.mockResolvedValue({ id: "profile-1" });

    await expect(completeProfileAction(names)).resolves.toEqual({ ok: true });
    expect(profileMocks.ensureUserInfo).not.toHaveBeenCalled();
  });

  it("rejects a caller without a session", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(completeProfileAction(names)).resolves.toMatchObject({
      ok: false,
    });
    expect(profileMocks.ensureUserInfo).not.toHaveBeenCalled();
  });

  it("requires both names", async () => {
    await expect(
      completeProfileAction({ firstName: "Ada", lastName: "  " }),
    ).resolves.toEqual({ ok: false, error: "First and last name are required." });
    expect(profileMocks.ensureUserInfo).not.toHaveBeenCalled();
  });

  it("creates the profile with trimmed names", async () => {
    await expect(
      completeProfileAction({ firstName: " Ada ", lastName: " Lovelace " }),
    ).resolves.toEqual({ ok: true });
    expect(profileMocks.ensureUserInfo).toHaveBeenCalledWith(
      expect.objectContaining({ id: "auth-user-1" }),
      names,
    );
  });

  it("passes a conflict's message through", async () => {
    profileMocks.ensureUserInfo.mockResolvedValue({
      status: "conflict",
      message: "That email belongs to another profile.",
    });

    await expect(completeProfileAction(names)).resolves.toEqual({
      ok: false,
      error: "That email belongs to another profile.",
    });
  });
});
