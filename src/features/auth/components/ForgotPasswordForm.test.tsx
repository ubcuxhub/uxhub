// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

const authMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(cleanup);

  it("routes reset links through the callback and stays pending on navigation", async () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Student@Example.com " },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Send reset link" }),
      );
    });

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "student@example.com",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Fupdate-password",
      },
    );
    expect(routerMocks.push).toHaveBeenCalledWith("/auth/check-email");
    expect(
      (screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("starts with the email carried over from Sign in", () => {
    sessionStorage.setItem("uxhub-pending-auth-email", "carried@example.com");
    render(<ForgotPasswordForm />);

    expect(
      (screen.getByLabelText("Email") as HTMLInputElement).value,
    ).toBe("carried@example.com");
  });

  it("names an invalid address on the field without calling Supabase", async () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jamie.lee@gmail" },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Send reset link" }),
      );
    });

    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
