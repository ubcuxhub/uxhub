// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserPurchaseSummary } from "../types";
import { UserRecentTransactions } from "./UserRecentTransactions";

const fetchPurchases = vi.hoisted(() => vi.fn());
vi.mock("../user-purchases-action", () => ({ fetchAdminUserPurchasesAction: fetchPurchases }));
afterEach(cleanup);
beforeEach(() => { fetchPurchases.mockReset(); });

function purchase(title: string): UserPurchaseSummary {
  return { id: title, title, kind: "membership", amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01T12:00:00Z" };
}

describe("UserRecentTransactions", () => {
  it("shows loading then real purchase data and an award placeholder", async () => {
    let finish!: (purchases: UserPurchaseSummary[]) => void;
    fetchPurchases.mockReturnValue(new Promise<UserPurchaseSummary[]>((resolve) => { finish = resolve; }));
    render(<UserRecentTransactions userId="dora" />);
    expect(screen.getByRole("status", { name: "Loading recent transactions" })).toBeTruthy();
    await act(async () => { finish([purchase("Innovator")]); });
    expect(screen.getByText("Innovator")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.getByText("Competition awards: Under Construction")).toBeTruthy();
  });

  it("distinguishes empty history from errors and supports retry", async () => {
    fetchPurchases.mockRejectedValueOnce(new Error("Failed")).mockResolvedValueOnce([]);
    render(<UserRecentTransactions userId="dora" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No purchases yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No purchases yet.")).toBeTruthy();
    expect(fetchPurchases).toHaveBeenCalledTimes(2);
  });

  it("ignores an old response after switching users", async () => {
    let finishOld!: (purchases: UserPurchaseSummary[]) => void;
    let finishNew!: (purchases: UserPurchaseSummary[]) => void;
    fetchPurchases
      .mockReturnValueOnce(new Promise<UserPurchaseSummary[]>((resolve) => { finishOld = resolve; }))
      .mockReturnValueOnce(new Promise<UserPurchaseSummary[]>((resolve) => { finishNew = resolve; }));
    const { rerender } = render(<UserRecentTransactions key="old" userId="old" />);
    rerender(<UserRecentTransactions key="new" userId="new" />);
    await act(async () => { finishNew([purchase("New user purchase")]); });
    await act(async () => { finishOld([purchase("Old user purchase")]); });
    expect(screen.getByText("New user purchase")).toBeTruthy();
    expect(screen.queryByText("Old user purchase")).toBeNull();
  });

  it("ignores a late failure after the modal closes and reopens", async () => {
    let rejectOld!: (error: Error) => void;
    fetchPurchases
      .mockReturnValueOnce(new Promise<UserPurchaseSummary[]>((_resolve, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce([purchase("Reopened purchase")]);
    const { rerender } = render(<UserRecentTransactions key="first-open" userId="dora" />);
    rerender(<></>);
    rerender(<UserRecentTransactions key="second-open" userId="dora" />);
    expect(await screen.findByText("Reopened purchase")).toBeTruthy();
    await act(async () => { rejectOld(new Error("Old request failed")); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Reopened purchase")).toBeTruthy();
  });
});
