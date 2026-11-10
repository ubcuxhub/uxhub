// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";

import { LoginForm } from "./LoginForm";

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function submitLogin() {
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));
  }

  it("unlocks with an actionable message when sign-in times out", async () => {
    vi.useFakeTimers();
    authMocks.signInWithPassword.mockReturnValue(new Promise(() => {}));

    render(<LoginForm />);
    submitLogin();

    expect(
      (
        screen.getByRole("button", {
          name: "Sign in",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });

    expect(
      screen.getByText(
        "This is taking longer than expected. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(routerMocks.replace).not.toHaveBeenCalled();
  });

  it("stays pending after success while navigation commits", async () => {
    authMocks.signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginForm nextPath="/portal/events" />);

    await act(async () => {
      submitLogin();
    });

    expect(routerMocks.replace).toHaveBeenCalledWith("/portal/events");
    expect(
      (
        screen.getByRole("button", {
          name: "Sign in",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("unlocks if successful sign-in navigation never commits", async () => {
    vi.useFakeTimers();
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm nextPath="/portal/events" />);

    await act(async () => {
      submitLogin();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });

    expect(
      screen.getByText(
        "You are signed in, but the next page did not load. Try again.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("ignores duplicate submissions while sign-in is pending", async () => {
    vi.useFakeTimers();
    authMocks.signInWithPassword.mockReturnValue(new Promise(() => {}));

    render(<LoginForm />);
    submitLogin();
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(authMocks.signInWithPassword).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });
  });

  it("shows wrong credentials on the password field", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error("Invalid login credentials"), {
        code: "invalid_credentials",
      }),
    });

    render(<LoginForm />);
    await act(async () => {
      submitLogin();
    });

    const message =
      "That email and password don't match. Try again or reset your password.";
    expect(screen.getByText(message)).toBeTruthy();
    expect(
      screen.getByLabelText("Password").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(routerMocks.replace).not.toHaveBeenCalled();
  });

  it("sends an unconfirmed account to Verify email with its address", async () => {
    sessionStorage.clear();
    authMocks.signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error("Email not confirmed"), {
        code: "email_not_confirmed",
      }),
    });

    render(<LoginForm nextPath="/portal/events" />);
    await act(async () => {
      submitLogin();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/auth/verify-email?next=%2Fportal%2Fevents",
    );
    expect(sessionStorage.getItem("uxhub-pending-auth-email")).toBe(
      "student@example.com",
    );
  });

  it("carries the typed email to Forgot password", () => {
    sessionStorage.clear();
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Student@Example.com" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Forgot password?" }));

    expect(sessionStorage.getItem("uxhub-pending-auth-email")).toBe(
      "student@example.com",
    );
  });
});
