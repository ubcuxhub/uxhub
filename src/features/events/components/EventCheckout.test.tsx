// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { EventCheckout } from "./EventCheckout";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

const context = vi.hoisted(() => ({ membershipTermEndsAt: null as string | null }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => context }));
vi.mock("@/components/shared/FlowDialog", () => ({ useFlowDialog: () => ({ close: vi.fn() }) }));
vi.mock("@/components/shared/CheckoutLayout", () => ({
  CheckoutLayout: ({ price, notice, payment }: { price: number; notice?: ReactNode; payment: { freeButtonLabel?: string } }) => (
    <div><div role="status">{price}</div>{notice}<span>{payment.freeButtonLabel}</span></div>
  ),
}));
afterEach(() => { cleanup(); context.membershipTermEndsAt = null; });

it.each([
  ["figma", "2099-01-01", null, 0],
  ["figma", "2000-01-01", null, 12.5],
  ["figma", "2099-01-01", "2000-01-01", 12.5],
  ["legacy", "2000-01-01", null, 5],
] as const)("quotes %s pricing with expiry %s and term %s", (policy, expiry, term, expected) => {
  context.membershipTermEndsAt = term;
  const event = { name: "Design Sprint", pricing_policy: policy, member_price: policy === "figma" ? 0 : 5, regular_price: 12.5 } as EventRow;
  const user = { membership_type_id: "tier", membership_expires_at: expiry } as UserInfoRow;
  render(<EventCheckout disabledMessage={null} event={event} formattedDate={null} slug="sprint" user={user} />);
  expect(screen.getByRole("status").textContent).toBe(String(expected));
});

it.each([
  ["free", 0, true],
  ["paid", 12.5, false],
] as const)("lets staff test-register only on a %s draft", (_label, regular, offered) => {
  const event = { name: "Draft Sprint", status: "draft", pricing_policy: "figma", member_price: 0, regular_price: regular } as EventRow;
  const user = { membership_type_id: null, membership_expires_at: null } as UserInfoRow;
  render(<EventCheckout disabledMessage={null} event={event} formattedDate={null} slug="draft-sprint" user={user} />);
  expect(screen.queryAllByText("Test registration (staff only)").length > 0).toBe(offered);
  expect(Boolean(screen.queryByText(/This creates a real registration/))).toBe(offered);
  expect(Boolean(screen.queryByText(/Paid drafts can’t be test-registered/))).toBe(!offered);
  expect(Boolean(screen.queryByRole("status"))).toBe(offered);
});
