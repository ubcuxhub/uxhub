import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

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

describe("POST /api/auth/complete-profile", () => {
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
  });

  it("returns success when a prior request already completed the profile", async () => {
    profileMocks.fetchUserInfoByAuthId.mockResolvedValue({ id: "profile-1" });

    const response = await POST(
      new Request("http://localhost/api/auth/complete-profile", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(profileMocks.ensureUserInfo).not.toHaveBeenCalled();
  });
});
