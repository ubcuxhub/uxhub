// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpdatePasswordForm } from "./UpdatePasswordForm";

const authMocks = vi.hoisted(() => ({ updateUser: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

describe("UpdatePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.updateUser.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  function submit(value: string) {
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value },
    });
    return act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save password" }));
    });
  }

  it("names the account being recovered", () => {
    render(<UpdatePasswordForm email="jamie.lee@gmail.com" />);
    expect(screen.getByText("jamie.lee@gmail.com")).toBeTruthy();
    expect(screen.getByText("At least 8 characters.")).toBeTruthy();
  });

  it("rejects a short password on the field before calling Supabase", async () => {
    render(<UpdatePasswordForm email="jamie.lee@gmail.com" />);
    await submit("1234567");

    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("saves an eight character password and goes to the portal", async () => {
    render(<UpdatePasswordForm email="jamie.lee@gmail.com" />);
    await submit("12345678");

    expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "12345678" });
    expect(routerMocks.push).toHaveBeenCalledWith("/portal");
  });
});
