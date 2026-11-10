import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
}));

const ensureUserInfo = vi.hoisted(() => vi.fn());

const fetchSetupStepByAuthId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-helpers/setup", () => ({ fetchSetupStepByAuthId }));

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
    fetchSetupStepByAuthId.mockResolvedValue("done");
  });

  function callback(next?: string) {
    const query = next ? `&next=${encodeURIComponent(next)}` : "";
    return GET(new NextRequest(`https://example.com/auth/callback?code=c${query}`));
  }

  it("sends a member who hasn't finished setup straight to setup", async () => {
    fetchSetupStepByAuthId.mockResolvedValue("dietary");
    const response = await callback();
    expect(fetchSetupStepByAuthId).toHaveBeenCalledWith(expect.anything(), "auth-user-1");
    expect(response.headers.get("location")).toBe("https://example.com/portal/setup");
  });

  it("lets a finished member through to the portal", async () => {
    const response = await callback("/portal");
    expect(response.headers.get("location")).toBe("https://example.com/portal");
  });

  it("honours a non-portal next without gating it", async () => {
    fetchSetupStepByAuthId.mockResolvedValue("dietary");
    const response = await callback("/portal/events/x/checkout");
    expect(response.headers.get("location")).toBe(
      "https://example.com/portal/events/x/checkout"
    );
  });

  it("falls back to next when the lookup fails", async () => {
    fetchSetupStepByAuthId.mockRejectedValue(new Error("db down"));
    const response = await callback();
    expect(response.headers.get("location")).toBe("https://example.com/portal");
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

  it("sends an expired confirmation link to the verify-expired screen", async () => {
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://example.com/auth/link-expired?type=verify",
    );
    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sends an expired recovery link to the reset-expired screen", async () => {
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?error_code=otp_expired&next=%2Fauth%2Fupdate-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://example.com/auth/link-expired?type=reset",
    );
  });

  it("routes an expired code exchange the same way", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      error: { code: "flow_state_expired", message: "expired" },
    });

    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?code=old&next=%2Fportal%2Fevents",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://example.com/auth/link-expired?type=verify&next=%2Fportal%2Fevents",
    );
  });

  it("keeps the generic error for other provider failures", async () => {
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?error=access_denied&error_code=unexpected_failure",
      ),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/auth/error",
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
