// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setPendingEmail } from "../pending-email";
import { SignUpSuccessMessage } from "./sign-up-success-message";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  resend: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

type AuthStateCallback = (
  event: string,
  session: { user: { id: string } } | null,
) => void;

describe("SignUpSuccessMessage", () => {
  let authStateCallback: AuthStateCallback;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    setPendingEmail("student@example.com");

    authMocks.getSession.mockResolvedValue({
      data: { session: null },
    });
    authMocks.resend.mockResolvedValue({ error: null });
    authMocks.onAuthStateChange.mockImplementation(
      (callback: AuthStateCallback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe } } };
      },
    );
  });

  afterEach(cleanup);

  it("redirects an authenticated session on mount and clears pending email", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    render(<SignUpSuccessMessage nextPath="/portal/events/summit" />);

    await waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(
        "/portal/events/summit",
      );
    });
    expect(sessionStorage.getItem("uxhub-pending-auth-email")).toBeNull();
  });

  it("redirects when another tab publishes an authenticated session", async () => {
    render(<SignUpSuccessMessage nextPath="/admin/events" />);

    await waitFor(() => {
      expect(authMocks.onAuthStateChange).toHaveBeenCalledOnce();
    });

    act(() => {
      authStateCallback("SIGNED_IN", { user: { id: "user-1" } });
    });

    expect(routerMocks.replace).toHaveBeenCalledWith("/admin/events");
    expect(sessionStorage.getItem("uxhub-pending-auth-email")).toBeNull();
  });

  it("checks shared session cookies again when the old tab regains focus", async () => {
    render(<SignUpSuccessMessage nextPath="/portal/settings" />);

    await waitFor(() => {
      expect(authMocks.getSession).toHaveBeenCalledOnce();
    });

    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    fireEvent.focus(window);

    await waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith("/portal/settings");
    });
  });

  it("checks authentication immediately before resending", async () => {
    render(<SignUpSuccessMessage nextPath="/portal" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resend email" })).toBeTruthy();
    });

    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    await waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith("/portal");
    });
    expect(authMocks.resend).not.toHaveBeenCalled();
  });

  it("resends for an unauthenticated user using the retained destination", async () => {
    render(<SignUpSuccessMessage nextPath="/portal/events/summit?tab=tickets" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Resend email" }),
    );

    await waitFor(() => {
      expect(authMocks.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "student@example.com",
        options: {
          emailRedirectTo:
            "http://localhost:3000/auth/callback?next=%2Fportal%2Fevents%2Fsummit%3Ftab%3Dtickets",
        },
      });
    });
  });
});
