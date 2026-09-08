import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
}));

const ensureUserInfo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("@/lib/auth/ensure-user-info", () => ({
  ensureUserInfo,
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "student@example.com",
          user_metadata: {},
        },
      },
      error: null,
    });
    ensureUserInfo.mockResolvedValue({ status: "ok" });
  });

  it("exchanges recovery codes before reaching the password update form", async () => {
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?code=recovery-code&next=%2Fauth%2Fupdate-password",
      ),
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith(
      "recovery-code",
    );
    expect(response.headers.get("location")).toBe(
      "https://example.com/auth/update-password",
    );
  });

  it("uses a stable recoverable error and preserves safe next handling", async () => {
    authMocks.exchangeCodeForSession.mockRejectedValue(
      new Error("raw provider details"),
    );

    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?code=bad-code&next=%2F%2Fevil.example",
      ),
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/auth/error");
    expect(location.searchParams.get("next")).toBe("/portal");
    expect(location.searchParams.get("error")).toBe(
      "We couldn't complete sign-in. The link may have expired or already been used. Try signing in again.",
    );
    expect(location.toString()).not.toContain("raw%20provider%20details");
  });
});
