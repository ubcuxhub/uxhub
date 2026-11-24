import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getUser: vi.fn() }));
const fetchUserInfoByAuthId = vi.hoisted(() => vi.fn());
const ensureUserInfo = vi.hoisted(() => vi.fn());
const logMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// `cache()` is a per-request memo in a server render and a no-op outside
// one; passing the function through keeps each test's call independent.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: authMocks }),
}));
vi.mock("@/lib/supabase-helpers/users", () => ({ fetchUserInfoByAuthId }));
// The real module would load the service-role client.
vi.mock("@/lib/auth/ensure-user-info", () => ({
  ensureUserInfo,
  PROFILE_CONFLICT_EVENTS: {
    missing_email: "auth.profile_missing_email",
    linked_elsewhere: "auth.profile_linked_elsewhere",
  },
}));
vi.mock("@/lib/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log")>()),
  log: logMocks,
}));

import { loadCurrentUser } from "./current-user";

const profile = { id: "profile-1", auth_user_id: "auth-user-1" };

describe("loadCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "student@example.com" } },
      error: null,
    });
    fetchUserInfoByAuthId.mockResolvedValue(profile);
    ensureUserInfo.mockResolvedValue({ status: "ok" });
  });

  it("returns the profile without repairing or logging", async () => {
    await expect(loadCurrentUser()).resolves.toEqual({
      status: "authenticated",
      user: profile,
    });
    expect(ensureUserInfo).not.toHaveBeenCalled();
    expect(logMocks.warn).not.toHaveBeenCalled();
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("reports an anonymous visitor", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadCurrentUser()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  // Treating a failed read as "no profile" would run the repair, which writes.
  it("fails a profile read error instead of repairing, and reports it", async () => {
    fetchUserInfoByAuthId.mockRejectedValue({
      code: "57014",
      message: "row data here",
    });

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "error",
      code: "profile_unavailable",
    });
    expect(ensureUserInfo).not.toHaveBeenCalled();
    expect(logMocks.error).toHaveBeenCalledWith("auth.profile_read_failed", {
      errorType: "SupabaseError",
      code: "57014",
      authUserId: "auth-user-1",
    });
    expect(JSON.stringify(logMocks.error.mock.calls)).not.toContain("row data");
  });

  it("repairs a missing profile and returns the new row", async () => {
    fetchUserInfoByAuthId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(profile);

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "authenticated",
      user: profile,
    });
    expect(ensureUserInfo).toHaveBeenCalledTimes(1);
  });

  it("asks for a profile when the name is missing", async () => {
    fetchUserInfoByAuthId.mockResolvedValue(null);
    ensureUserInfo.mockResolvedValue({ status: "missing_name" });

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "needs_profile",
    });
  });

  it("logs a conflict by its reason, never its message", async () => {
    fetchUserInfoByAuthId.mockResolvedValue(null);
    ensureUserInfo.mockResolvedValue({
      status: "conflict",
      reason: "linked_elsewhere",
      message: "An account with this email is already linked to another sign-in method.",
    });

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "error",
      code: "linked_elsewhere",
    });
    expect(logMocks.warn).toHaveBeenCalledWith("auth.profile_linked_elsewhere", {
      authUserId: "auth-user-1",
      source: "current_user",
    });
  });

  it("logs a repair whose row still can't be read", async () => {
    fetchUserInfoByAuthId.mockResolvedValue(null);

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "error",
      code: "profile_unavailable",
    });
    expect(logMocks.warn).toHaveBeenCalledWith("auth.profile_repair_missing", {
      authUserId: "auth-user-1",
    });
  });

  it("reports a failed re-read after the repair", async () => {
    fetchUserInfoByAuthId
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("down"));

    await expect(loadCurrentUser()).resolves.toEqual({
      status: "error",
      code: "profile_unavailable",
    });
    expect(logMocks.error).toHaveBeenCalledWith("auth.profile_read_failed", {
      errorType: "Error",
      authUserId: "auth-user-1",
    });
  });
});
