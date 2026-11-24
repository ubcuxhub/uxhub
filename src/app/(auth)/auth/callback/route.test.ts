import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
}));

const ensureUserInfo = vi.hoisted(() => vi.fn());

const logMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log")>()),
  log: logMocks,
}));

vi.mock("server-only", () => ({}));

const fetchSetupStepByAuthId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-helpers/setup", () => ({ fetchSetupStepByAuthId }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: authMocks }),
}));

// The real module would load the service-role client, so its event map is
// restated here.
vi.mock("@/lib/auth/ensure-user-info", () => ({
  ensureUserInfo,
  PROFILE_CONFLICT_EVENTS: {
    missing_email: "auth.profile_missing_email",
    linked_elsewhere: "auth.profile_linked_elsewhere",
  },
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

  it("asks for a missing name instead of failing, keeping next", async () => {
    ensureUserInfo.mockResolvedValue({ status: "missing_name" });
    const response = await callback("/portal/membership/join");
    expect(response.headers.get("location")).toBe(
      "https://example.com/auth/complete-profile?next=%2Fportal%2Fmembership%2Fjoin",
    );
    expect(fetchSetupStepByAuthId).not.toHaveBeenCalled();
  });

  it("still reports a real conflict on the error page, logging its cause", async () => {
    ensureUserInfo.mockResolvedValue({
      status: "conflict",
      reason: "linked_elsewhere",
      message: "An account with this email is already linked to another sign-in method.",
    });
    const location = new URL((await callback()).headers.get("location")!);
    expect(location.pathname).toBe("/auth/error");
    expect(location.searchParams.get("code")).toBe("linked_elsewhere");
    expect(location.searchParams.has("error")).toBe(false);
    expect(logMocks.warn).toHaveBeenCalledWith("auth.profile_linked_elsewhere", {
      authUserId: "auth-user-1",
      source: "callback",
    });
  });

  it("logs a profile with no email by its own event", async () => {
    ensureUserInfo.mockResolvedValue({
      status: "conflict",
      reason: "missing_email",
      message: "Your account is missing an email address.",
    });
    await callback();
    expect(logMocks.warn).toHaveBeenCalledWith("auth.profile_missing_email", {
      authUserId: "auth-user-1",
      source: "callback",
    });
  });

  it("logs nothing on a successful sign-in", async () => {
    await callback();
    expect(logMocks.warn).not.toHaveBeenCalled();
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("logs a provider error by its code only", async () => {
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/callback?error=access_denied&error_code=bad_oauth_state&error_description=Secret%20user%20detail",
      ),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/error");
    expect(logMocks.warn).toHaveBeenCalledWith("auth.callback_provider_error", {
      errorCode: "bad_oauth_state",
    });
    expect(JSON.stringify(logMocks.warn.mock.calls)).not.toContain("Secret");
  });

  it("logs a callback that arrives without a code", async () => {
    await GET(new NextRequest("https://example.com/auth/callback"));
    expect(logMocks.warn).toHaveBeenCalledWith("auth.callback_missing_code");
  });

  it("logs a failed code exchange without its message", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      error: Object.assign(new Error("raw provider details"), {
        name: "AuthApiError",
        code: "bad_code_verifier",
      }),
    });
    await callback();
    expect(logMocks.warn).toHaveBeenCalledWith("auth.callback_exchange_failed", {
      errorType: "AuthApiError",
      code: "bad_code_verifier",
    });
    expect(JSON.stringify(logMocks.warn.mock.calls)).not.toContain("raw provider");
  });

  it("logs a failed user lookup", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "" } },
      error: null,
    });
    await callback();
    expect(logMocks.warn).toHaveBeenCalledWith("auth.callback_user_lookup_failed", {
      authUserId: "auth-user-1",
      missingEmail: true,
    });
  });

  it("logs a timeout at warn, not to Sentry", async () => {
    const { AsyncTimeoutError } = await import("@/lib/async/deadline");
    ensureUserInfo.mockRejectedValue(new AsyncTimeoutError(25_000, "Profile setup"));
    await callback();
    expect(logMocks.warn).toHaveBeenCalledWith("auth.callback_timeout", {
      errorType: "AsyncTimeoutError",
    });
    expect(logMocks.error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure through errorFields", async () => {
    ensureUserInfo.mockRejectedValue(new TypeError("row data here"));
    await callback();
    expect(logMocks.error).toHaveBeenCalledWith("auth.callback_failed", {
      errorType: "TypeError",
    });
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
    expect(location.searchParams.get("code")).toBe("callback");
    expect(location.toString()).not.toContain("raw%20provider%20details");
    expect(logMocks.error).toHaveBeenCalledWith("auth.callback_failed", {
      errorType: "Error",
    });
  });
});
