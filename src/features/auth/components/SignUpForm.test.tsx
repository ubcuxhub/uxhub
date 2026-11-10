// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpForm } from "./SignUpForm";

const authMocks = vi.hoisted(() => ({ signUp: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("../actions", () => ({ completeProfileAction: vi.fn() }));

const EXISTS = "An account with this email already exists.";

describe("SignUpForm existing account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(cleanup);

  async function submit() {
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Lee" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Student@Example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "longenoughpassword" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Create account" }));
    });
  }

  async function expectEmailError() {
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.getAttribute("aria-invalid")).toBe("true");
    const alert = screen.getByText(EXISTS, { exact: false });
    expect(email.getAttribute("aria-describedby")).toContain(alert.id);
    expect(document.activeElement).toBe(email);
    expect(routerMocks.push).not.toHaveBeenCalled();

    const link = screen.getByRole("link", { name: "Sign in instead" });
    expect(link.getAttribute("href")).toBe("/auth/login?next=%2Fportal");
    fireEvent.click(link);
    expect(sessionStorage.getItem("uxhub-pending-auth-email")).toBe(
      "student@example.com",
    );
  }

  it.each(["user_already_exists", "email_exists"])(
    "shows a field error for the %s code",
    async (code) => {
      authMocks.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: Object.assign(new Error("User already registered"), { code }),
      });
      render(<SignUpForm />);
      await submit();
      await expectEmailError();
    },
  );

  it("shows a field error for an obfuscated user with no identities", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "u", identities: [] }, session: null },
      error: null,
    });
    render(<SignUpForm />);
    await submit();
    await expectEmailError();
  });

  it("keeps the next param on the sign-in link", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "u", identities: [] }, session: null },
      error: null,
    });
    render(<SignUpForm nextPath="/portal/events" />);
    await submit();
    expect(
      screen.getByRole("link", { name: "Sign in instead" }).getAttribute("href"),
    ).toBe("/auth/login?next=%2Fportal%2Fevents");
  });

  it("still routes a genuine sign-up to verify-email", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "u", identities: [{ id: "i" }] }, session: null },
      error: null,
    });
    render(<SignUpForm />);
    await submit();
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/auth/verify-email?next=%2Fportal",
    );
  });
});
