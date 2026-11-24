import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getSession } })),
}));

import { config, proxy } from "./proxy";

/** Whether Next would run the proxy for `pathname` (`/x/:path*` patterns only). */
function matches(pathname: string) {
  return config.matcher.some((pattern) => {
    const base = pattern.replace(/\/:path\*$/, "");
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

describe("proxy", () => {
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ data: { session: null } });
  });

  // Each of these reads the session with the cookie client, so a refresh it
  // triggers has to land somewhere that can set cookies.
  it.each([
    "/portal",
    "/admin/users",
    "/join/abc",
    "/api/profile-photo",
    "/auth/login",
    "/auth/update-password",
    "/events",
    "/events/uxathon",
  ])("refreshes the session for %s", (pathname) => {
    expect(matches(pathname)).toBe(true);
  });

  it("leaves the homepage alone", () => {
    expect(matches("/")).toBe(false);
  });

  it("refreshes the session and records the requested path", async () => {
    const res = await proxy(new NextRequest("https://example.com/events/uxathon?ref=1"));
    expect(getSession).toHaveBeenCalledOnce();
    expect(res.headers.get("x-middleware-request-x-uxhub-path")).toBe(
      "/events/uxathon?ref=1",
    );
  });

  it("doesn't refresh the session the auth callback is replacing", async () => {
    await proxy(new NextRequest("https://example.com/auth/callback?code=abc"));
    expect(getSession).not.toHaveBeenCalled();
  });
});
