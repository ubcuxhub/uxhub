// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const deleteAccountAction = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../actions", () => ({
  deleteAccountAction,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: ({
    error,
    onConfirm,
    pending,
  }: {
    error?: string | null;
    onConfirm: (confirmation: string) => void;
    pending?: boolean;
  }) => (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onConfirm("member@student.ubc.ca")}
      >
        {pending ? "Deleting..." : "Delete account"}
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  ),
}));

describe("DeleteAccountDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteAccountAction.mockResolvedValue({ ok: true });
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    authMocks.signOut.mockResolvedValue({ error: null });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows returned failures and always resets pending", async () => {
    deleteAccountAction.mockResolvedValue({
      ok: false,
      error: "Your account could not be deleted.",
    });
    renderDialog();

    await submitDeletion();

    expect(
      screen.getByText("Your account could not be deleted."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Delete account",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(authMocks.getUser).not.toHaveBeenCalled();
  });

  it("reconciles a thrown transport failure to an active retry path", async () => {
    deleteAccountAction.mockRejectedValue(new TypeError("fetch failed"));
    renderDialog();

    await submitDeletion();

    expect(
      screen.getByText(
        "Your account is still active. The deletion request did not complete normally and was not retried automatically. You can try again.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Delete account",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(deleteAccountAction).toHaveBeenCalledTimes(1);
  });

  it("reports an unknown outcome and unlocks after bounded checks time out", async () => {
    vi.useFakeTimers();
    deleteAccountAction.mockImplementation(
      () => new Promise(() => undefined),
    );
    authMocks.getUser.mockImplementation(() => new Promise(() => undefined));
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
      await Promise.resolve();
    });
    expect(
      (screen.getByRole("button", {
        name: "Deleting...",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });

    expect(
      screen.getByText(
        "The deletion outcome is unknown because the request or account check did not complete. It was not retried automatically. Check your connection before trying again.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", {
        name: "Delete account",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(deleteAccountAction).toHaveBeenCalledTimes(1);
  });

  it("treats an invalid auth user as successful deletion and clears locally", async () => {
    deleteAccountAction.mockRejectedValue(new TypeError("response lost"));
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401 },
    });
    renderDialog();

    await submitDeletion();

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(routerMocks.replace).toHaveBeenCalledWith("/auth/login");
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
    expect(deleteAccountAction).toHaveBeenCalledTimes(1);
  });

  it("clears locally and navigates when remote sign-out fails", async () => {
    authMocks.signOut.mockImplementation(
      (options?: { scope?: string }) =>
        options?.scope === "local"
          ? Promise.resolve({ error: null })
          : Promise.resolve({ error: { code: "request_failed" } }),
    );
    renderDialog();

    await submitDeletion();

    expect(authMocks.signOut).toHaveBeenNthCalledWith(1);
    expect(authMocks.signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
    expect(routerMocks.replace).toHaveBeenCalledWith("/auth/login");
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
    expect(
      (screen.getByRole("button", {
        name: "Delete account",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

function renderDialog() {
  render(
    <DeleteAccountDialog
      open
      onOpenChange={vi.fn()}
      email="member@student.ubc.ca"
    />,
  );
}

async function submitDeletion() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await Promise.resolve();
  });
}
