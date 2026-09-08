// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";

import { LoginForm } from "./login-form";

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
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
          name: "Signing in...",
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
          name: "Signing in...",
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
      screen.getByRole("button", { name: "Signing in..." }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(authMocks.signInWithPassword).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });
  });
});
