import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoleAccess, UserInfoRow } from "@/lib/supabase/models";
import {
  redirectIfAuthenticated,
  requireAdmin,
  requireAuth,
  requireManager,
} from "./guards";

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    // The real redirect() throws, and that throw is what stops a guard from
    // returning a user it has just rejected. A mock that returned normally
    // would let execution continue past the redirect and hide the exact bug
    // these tests exist to catch.
    throw new Error(`NEXT_REDIRECT ${destination}`);
  }),
}));

const currentUserMocks = vi.hoisted(() => ({
  loadCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: navigationMocks.redirect }));

vi.mock("@/lib/auth/current-user", () => ({
  loadCurrentUser: currentUserMocks.loadCurrentUser,
}));

// `getSafeInternalPath` and the role predicates are deliberately left real.
// The point of these tests is the composition -- that the guard actually
// sanitizes the path it was handed and actually consults the role.

function authenticatedAs(role: RoleAccess | null) {
  const user = { id: "user-1", role_access: role } as UserInfoRow;

  currentUserMocks.loadCurrentUser.mockResolvedValue({
    status: "authenticated",
    user,
  });

  return user;
}

async function expectRedirect(run: () => Promise<unknown>, destination: string) {
  await expect(run()).rejects.toThrow("NEXT_REDIRECT");
  expect(navigationMocks.redirect).toHaveBeenCalledWith(destination);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("returns the profile row for a signed-in user", async () => {
    const user = authenticatedAs("basic");

    await expect(requireAuth()).resolves.toBe(user);
    expect(navigationMocks.redirect).not.toHaveBeenCalled();
  });

  it("sends an anonymous visitor to login with the requested path preserved", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expectRedirect(
      () => requireAuth("/portal/membership/join"),
      "/auth/login?next=%2Fportal%2Fmembership%2Fjoin"
    );
  });

  it("falls back to the portal when no path was requested", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expectRedirect(() => requireAuth(), "/auth/login?next=%2Fportal");
  });

  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a backslash-escaped host", "/\\evil.example"],
  ])("refuses to bounce a visitor off-site through %s", async (_label, nextPath) => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expectRedirect(
      () => requireAuth(nextPath),
      "/auth/login?next=%2Fportal"
    );
  });

  it("surfaces a profile-loading error on the auth error page", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "error",
      message: "Unable to load your profile.",
    });

    await expectRedirect(
      () => requireAuth(),
      "/auth/error?error=Unable%20to%20load%20your%20profile."
    );
  });
});

describe("requireAdmin", () => {
  it.each<RoleAccess>(["admin", "manager"])(
    "admits a %s",
    async (role) => {
      const user = authenticatedAs(role);

      await expect(requireAdmin()).resolves.toBe(user);
      expect(navigationMocks.redirect).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["a basic member", "basic" as RoleAccess],
    ["a user with no role", null],
  ])("sends %s to the unauthorized page", async (_label, role) => {
    authenticatedAs(role);

    await expectRedirect(() => requireAdmin(), "/401");
  });

  it("sends an anonymous visitor to login rather than to /401", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expectRedirect(() => requireAdmin(), "/auth/login?next=%2Fportal");
  });
});

describe("requireManager", () => {
  it("admits a manager", async () => {
    const user = authenticatedAs("manager");

    await expect(requireManager()).resolves.toBe(user);
    expect(navigationMocks.redirect).not.toHaveBeenCalled();
  });

  // Manager is the narrower role: every manager is an admin, but an admin is
  // not a manager. Collapsing the two would silently widen manager-only pages.
  it("turns an admin away", async () => {
    authenticatedAs("admin");

    await expectRedirect(() => requireManager(), "/401");
  });

  it("turns a basic member away", async () => {
    authenticatedAs("basic");

    await expectRedirect(() => requireManager(), "/401");
  });
});

describe("redirectIfAuthenticated", () => {
  it("leaves an anonymous visitor on the auth page", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "unauthenticated",
    });

    await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
    expect(navigationMocks.redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-in user to the portal by default", async () => {
    authenticatedAs("basic");

    await expectRedirect(() => redirectIfAuthenticated(), "/portal");
  });

  it("keeps a safe internal destination", async () => {
    authenticatedAs("admin");

    await expectRedirect(
      () => redirectIfAuthenticated("/admin/users"),
      "/admin/users"
    );
  });

  // A crafted auth link is the attack this sanitizing exists for: without it,
  // the link bounces an already-signed-in user straight off-site.
  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
  ])("refuses %s as a destination", async (_label, destination) => {
    authenticatedAs("basic");

    await expectRedirect(
      () => redirectIfAuthenticated(destination),
      "/portal"
    );
  });

  it("surfaces a profile-loading error instead of redirecting", async () => {
    currentUserMocks.loadCurrentUser.mockResolvedValue({
      status: "error",
      message: "Your profile could not be loaded.",
    });

    await expectRedirect(
      () => redirectIfAuthenticated(),
      "/auth/error?error=Your%20profile%20could%20not%20be%20loaded."
    );
  });
});
