// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  user: { user: { id: "user-1" } as { id: string } | null, loading: false },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/supabase-helpers/purchases", () => ({ fetchPurchasesForUser: mocks.fetch }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => mocks.user }));

import { PurchaseHistorySettings } from "./PurchaseHistorySettings";

const purchase = {
  id: "p1", kind: "membership", status: "completed", amount_cents: 2000, currency: "CAD",
  created_at: "2026-09-01T18:00:00Z", refunded_cents: 0,
  membership_types: { name: "Annual membership" }, events: null,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { user: { id: "user-1" }, loading: false };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("shows a spinner, then the purchases", async () => {
  mocks.fetch.mockResolvedValue([purchase]);
  render(<PurchaseHistorySettings />);
  expect(screen.getByRole("status").textContent).toBe("Loading purchases");
  expect(await screen.findByText("Annual membership")).toBeTruthy();
});

it("says the load failed, not that there are no purchases, and retries", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([purchase]);
  render(<PurchaseHistorySettings />);
  expect(await screen.findByText("Your purchases couldn’t be loaded")).toBeTruthy();
  expect(screen.queryByText("No purchases yet")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Annual membership")).toBeTruthy();
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it("says there are none when the read succeeds empty", async () => {
  mocks.fetch.mockResolvedValue([]);
  render(<PurchaseHistorySettings />);
  expect(await screen.findByText("No purchases yet")).toBeTruthy();
});

it("doesn't spin forever without a user", () => {
  mocks.user = { user: null, loading: false };
  const { container } = render(<PurchaseHistorySettings />);
  expect(container.innerHTML).toBe("");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
