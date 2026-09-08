import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccountAction } from "./actions";

const requireAuth = vi.hoisted(() => vi.fn());
const adminDeleteAccount = vi.hoisted(() => vi.fn());

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
    expect(consoleError).toHaveBeenCalledWith(
      "Account deletion failed",
      { errorType: "Error" },
    );

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
