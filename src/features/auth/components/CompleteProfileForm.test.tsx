// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompleteProfileForm } from "./CompleteProfileForm";

const authMocks = vi.hoisted(() => ({ signOut: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const completeProfileAction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("../actions", () => ({ completeProfileAction }));
vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: () => null }));

function firstName() {
  return screen.getByLabelText("First name") as HTMLInputElement;
}

function lastName() {
  return screen.getByLabelText(/^Last name/) as HTMLInputElement;
}

function submit() {
  return act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }));
  });
}

describe("CompleteProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeProfileAction.mockResolvedValue({ ok: true });
    authMocks.signOut.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it("asks for a name, prefilled with what the provider sent", () => {
    render(
      <CompleteProfileForm
        nextPath="/portal/membership/join"
        email="prince@gmail.com"
        defaultFirstName="Prince"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "What should we call you?" }),
    ).toBeTruthy();
    expect(screen.getByText(/Google didn't share your name/)).toBeTruthy();
    expect(screen.getByText("prince@gmail.com")).toBeTruthy();
    expect(firstName().value).toBe("Prince");
    expect(lastName().value).toBe("");
    // The last name is optional, for people with one name.
    expect(firstName().required).toBe(true);
    expect(lastName().required).toBe(false);
    expect(lastName().labels?.[0]?.textContent).toContain("Optional");
  });

  it("saves the trimmed names and continues to next", async () => {
    render(
      <CompleteProfileForm
        nextPath="/portal/membership/join"
        defaultFirstName="Prince"
      />,
    );
    fireEvent.change(lastName(), { target: { value: "  Nelson " } });
    await submit();

    expect(completeProfileAction).toHaveBeenCalledWith({
      firstName: "Prince",
      lastName: "Nelson",
    });
    expect(routerMocks.replace).toHaveBeenCalledWith("/portal/membership/join");
  });

  it("saves a single name with an empty last name", async () => {
    render(<CompleteProfileForm defaultLastName="Nelson" />);
    fireEvent.change(firstName(), { target: { value: " Prince " } });
    fireEvent.change(lastName(), { target: { value: "   " } });
    await submit();

    expect(completeProfileAction).toHaveBeenCalledWith({
      firstName: "Prince",
      lastName: "",
    });
    expect(screen.queryByText(/Enter your/)).toBeNull();
  });

  it("names a blank first name on the field without calling the action", async () => {
    render(<CompleteProfileForm defaultLastName="Nelson" />);
    fireEvent.change(firstName(), { target: { value: "   " } });
    await submit();

    expect(screen.getByText("Enter your first name.")).toBeTruthy();
    expect(firstName().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(firstName());
    expect(completeProfileAction).not.toHaveBeenCalled();

    fireEvent.change(firstName(), { target: { value: "Prince" } });
    expect(screen.queryByText("Enter your first name.")).toBeNull();
  });

  it("shows the action's error and stays put", async () => {
    completeProfileAction.mockResolvedValue({
      ok: false,
      error: "An account with this email is already linked to another sign-in method.",
    });
    render(<CompleteProfileForm defaultFirstName="Prince" defaultLastName="Nelson" />);
    await submit();

    expect(
      screen.getByText(
        "An account with this email is already linked to another sign-in method.",
      ),
    ).toBeTruthy();
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows a generic error when the action throws", async () => {
    completeProfileAction.mockRejectedValue(new Error("raw details"));
    render(<CompleteProfileForm defaultFirstName="Prince" defaultLastName="Nelson" />);
    await submit();

    expect(
      screen.getByText("We couldn't save your name. Please try again."),
    ).toBeTruthy();
    expect(screen.queryByText(/raw details/)).toBeNull();
  });

  it("signs out and returns to login, keeping next, to use another account", async () => {
    render(<CompleteProfileForm nextPath="/portal/events/x/checkout" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use a different account" }),
      );
    });

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMocks.replace).toHaveBeenCalledWith(
      "/auth/login?next=%2Fportal%2Fevents%2Fx%2Fcheckout",
    );
  });

  it("still clears the local session when remote sign-out fails", async () => {
    authMocks.signOut
      .mockResolvedValueOnce({ error: new Error("network") })
      .mockResolvedValueOnce({ error: null });
    render(<CompleteProfileForm />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use a different account" }),
      );
    });

    expect(authMocks.signOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(routerMocks.replace).toHaveBeenCalledWith("/auth/login?next=%2Fportal");
  });
});
