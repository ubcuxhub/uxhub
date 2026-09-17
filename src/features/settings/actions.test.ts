import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
