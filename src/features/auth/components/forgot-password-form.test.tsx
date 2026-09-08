// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";

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
      (screen.getByRole("button", { name: "Sending..." }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
