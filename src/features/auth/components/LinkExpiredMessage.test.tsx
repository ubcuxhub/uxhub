// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LinkExpiredMessage } from "./LinkExpiredMessage";

const authMocks = vi.hoisted(() => ({
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));
// The artwork imports PNGs, which the test runner does not bundle.
vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: () => null }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

describe("LinkExpiredMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authMocks.resend.mockResolvedValue({ error: null });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it("resends the verification email to the pending address", async () => {
    sessionStorage.setItem("uxhub-pending-auth-email", "jamie.lee@gmail.com");
    render(<LinkExpiredMessage type="verify" nextPath="/portal" />);

    expect(screen.getByText("jamie.lee@gmail.com")).toBeTruthy();
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Send new link" }));
    });

    expect(authMocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "jamie.lee@gmail.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fportal",
      },
    });
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/auth/verify-email?next=%2Fportal",
    );
  });

  it("asks for the address when this browser never requested the email", async () => {
    render(<LinkExpiredMessage type="reset" />);

    expect(
      screen.getByText(/Reset links only work for a short time/),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Jamie.Lee@gmail.com" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Send new link" }));
    });

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "jamie.lee@gmail.com",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Fupdate-password",
      },
    );
    expect(routerMocks.push).toHaveBeenCalledWith("/auth/check-email");
  });

  it("rejects an invalid address without sending", async () => {
    render(<LinkExpiredMessage type="verify" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nope" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Send new link" }));
    });

    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(authMocks.resend).not.toHaveBeenCalled();
  });
});
