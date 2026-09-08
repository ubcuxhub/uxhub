import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureUserInfo } from "./ensure-user-info";

const helperMocks = vi.hoisted(() => ({
  adminFindUserInfoByEmail: vi.fn(),
  adminInsertUserInfo: vi.fn(),
  adminUpdateUserInfoById: vi.fn(),
  fetchUserInfoByAuthId: vi.fn(),
}));

const supabase = {};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => supabase,
}));

vi.mock("@/lib/supabase-helpers/admin-server", () => ({
  adminFindUserInfoByEmail: helperMocks.adminFindUserInfoByEmail,
  adminInsertUserInfo: helperMocks.adminInsertUserInfo,
  adminUpdateUserInfoById: helperMocks.adminUpdateUserInfoById,
}));

vi.mock("@/lib/supabase-helpers/users", () => ({
  fetchUserInfoByAuthId: helperMocks.fetchUserInfoByAuthId,
}));

const authUser = {
  id: "auth-user-1",
  email: "Student@Example.com",
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-09-08T00:00:00.000Z",
  user_metadata: {
    first_name: "Ada",
    last_name: "Lovelace",
  },
} as User;

describe("ensureUserInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.adminFindUserInfoByEmail.mockResolvedValue(null);
    helperMocks.adminInsertUserInfo.mockResolvedValue([]);
    helperMocks.adminUpdateUserInfoById.mockResolvedValue([]);
    helperMocks.fetchUserInfoByAuthId.mockResolvedValue(null);
  });

  it("treats an existing profile as idempotent success", async () => {
    helperMocks.fetchUserInfoByAuthId.mockResolvedValue({ id: "profile-1" });

    await expect(ensureUserInfo(authUser)).resolves.toEqual({ status: "ok" });
    expect(helperMocks.adminFindUserInfoByEmail).not.toHaveBeenCalled();
    expect(helperMocks.adminInsertUserInfo).not.toHaveBeenCalled();
  });

  it("reconciles a concurrent insert for the same auth user", async () => {
    helperMocks.fetchUserInfoByAuthId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "profile-1" });
    helperMocks.adminInsertUserInfo.mockRejectedValue({
      code: "23505",
    });

    await expect(ensureUserInfo(authUser)).resolves.toEqual({ status: "ok" });
    expect(helperMocks.fetchUserInfoByAuthId).toHaveBeenCalledTimes(2);
  });

  it("does not hide a race that linked the email to another auth user", async () => {
    helperMocks.fetchUserInfoByAuthId.mockResolvedValue(null);
    helperMocks.adminFindUserInfoByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "profile-2",
        auth_user_id: "auth-user-2",
        email: "student@example.com",
      });
    helperMocks.adminInsertUserInfo.mockRejectedValue({
      code: "23505",
    });

    await expect(ensureUserInfo(authUser)).resolves.toEqual({
      status: "conflict",
      message:
        "An account with this email is already linked to another sign-in method.",
    });
  });
});
