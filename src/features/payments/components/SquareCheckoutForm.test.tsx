// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";
import { getCheckoutAttemptStorageKey } from "@/features/payments/checkout-attempt";
import { SquareCheckoutForm } from "./SquareCheckoutForm";

const squareMocks = vi.hoisted(() => ({
  attach: vi.fn(),
  card: vi.fn(),
  configure: vi.fn(),
  destroy: vi.fn(),
  payments: vi.fn(),
  tokenize: vi.fn(),
  verifyBuyer: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  submitCheckoutAction: vi.fn(),
}));

vi.mock("@square/web-sdk", () => ({
  payments: squareMocks.payments,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/features/payments/actions", () => ({
  submitCheckoutAction: actionMocks.submitCheckoutAction,
}));

vi.mock("@/lib/theme", () => ({
  getThemeServerSnapshot: () => "light",
  getThemeSnapshot: () => "light",
  subscribeTheme: () => () => undefined,
}));

describe("SquareCheckoutForm deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_SQUARE_APP_ID", "sandbox-app");
    vi.stubEnv("NEXT_PUBLIC_SQUARE_LOCATION_ID", "location");

    squareMocks.attach.mockResolvedValue(undefined);
    squareMocks.configure.mockResolvedValue(undefined);
    squareMocks.destroy.mockResolvedValue(undefined);
    squareMocks.card.mockResolvedValue({
      attach: squareMocks.attach,
      configure: squareMocks.configure,
      destroy: squareMocks.destroy,
      tokenize: squareMocks.tokenize,
    });
    squareMocks.payments.mockResolvedValue({
      card: squareMocks.card,
      verifyBuyer: squareMocks.verifyBuyer,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("surfaces an initialization timeout instead of loading forever", async () => {
    vi.useFakeTimers();
    squareMocks.payments.mockReturnValue(new Promise(() => undefined));

    render(
      <SquareCheckoutForm
        amountCents={1_000}
        amountLabel="$10.00"
        buttonLabel="Pay now"
        collectBuyerDetails={false}
        initialEmail="student@example.com"
        initialFirstName="Student"
        initialLastName="Member"
        kind="membership"
        slug="student"
        userId="user-1"
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.userAction);
    });

    expect(
      screen.getByText(
        "This is taking longer than expected. Check your connection and try again.",
      ),
    ).toBeTruthy();
  });

  it("recovers the busy state when tokenization exceeds its deadline", async () => {
    vi.useFakeTimers();
    squareMocks.tokenize.mockReturnValue(new Promise(() => undefined));
    const onSubmittingChange = vi.fn();

    render(
      <SquareCheckoutForm
        amountCents={1_000}
        amountLabel="$10.00"
        buttonLabel="Pay now"
        collectBuyerDetails={false}
        initialEmail="student@example.com"
        initialFirstName="Student"
        initialLastName="Member"
        kind="membership"
        onSubmittingChange={onSubmittingChange}
        slug="student"
        userId="user-1"
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const storageKey = getCheckoutAttemptStorageKey({
      kind: "membership",
      slug: "student",
      userId: "user-1",
    });
    const attemptKey = sessionStorage.getItem(storageKey);

    fireEvent.submit(screen.getByRole("button", { name: "Pay now" }));
    expect(onSubmittingChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.checkout);
    });

    expect(
      screen.getByText(
        "This is taking longer than expected. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
    expect(sessionStorage.getItem(storageKey)).toBe(attemptKey);
    expect(
      (screen.getByRole("button", { name: "Pay now" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("does not submit a charge when buyer verification fails", async () => {
    squareMocks.tokenize.mockResolvedValue({
      status: "OK",
      token: "square-token",
    });
    squareMocks.verifyBuyer.mockRejectedValue(new Error("challenge failed"));

    render(
      <SquareCheckoutForm
        amountCents={1_000}
        amountLabel="$10.00"
        buttonLabel="Pay now"
        collectBuyerDetails={false}
        initialEmail="student@example.com"
        initialFirstName="Student"
        initialLastName="Member"
        kind="membership"
        slug="student"
        userId="user-1"
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.submit(screen.getByRole("button", { name: "Pay now" }));

    expect(
      await screen.findByText(
        "Your bank could not verify this payment. Please try again or use a different card.",
      ),
    ).toBeTruthy();
    expect(actionMocks.submitCheckoutAction).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Pay now" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
