// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";

import { PurchaseConfirmation, type ConfirmationState } from "./PurchaseConfirmation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const purchase = (fields: Partial<PurchaseWithDetails>) =>
  ({ status: "completed", amount_cents: 1500, refunded_cents: 0, failure_reason: null, ...fields }) as PurchaseWithDetails;

const copy = (state: ConfirmationState) => ({
  title: `title:${state}`,
  body: `body:${state}`,
  action: { href: `/${state}`, label: `go:${state}` },
});

describe("PurchaseConfirmation", () => {
  it.each([
    [{ status: "completed" }, "completed"],
    [{ status: "completed", refunded_cents: 1500 }, "refunded"],
    [{ status: "completed", refunded_cents: 500 }, "completed"],
    [{ status: "failed" }, "failed"],
    [{ status: "canceled" }, "failed"],
    [{ status: "pending" }, "pending"],
  ] as const)("reads %j as %s", (fields, state) => {
    render(<PurchaseConfirmation purchase={purchase(fields)} copy={copy} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`title:${state}`);
    expect(screen.getByText(`body:${state}`)).toBeTruthy();
    expect(screen.getByRole("link", { name: `go:${state}` }).getAttribute("href")).toBe(`/${state}`);
  });

  it("reports a completed purchase once", () => {
    const onCompleted = vi.fn();
    const { rerender } = render(
      <PurchaseConfirmation purchase={purchase({})} copy={copy} onCompleted={onCompleted} />,
    );
    rerender(<PurchaseConfirmation purchase={purchase({})} copy={copy} onCompleted={onCompleted} />);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("doesn't report a refunded one", () => {
    const onCompleted = vi.fn();
    render(
      <PurchaseConfirmation purchase={purchase({ refunded_cents: 1500 })} copy={copy} onCompleted={onCompleted} />,
    );
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
