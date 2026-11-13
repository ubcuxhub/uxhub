// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventCheckout } from "./EventCheckout";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

const context = vi.hoisted(() => ({ membershipTermEndsAt: null as string | null }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => context }));
vi.mock("@/components/shared/FlowDialog", () => ({ useFlowDialog: () => ({ close: vi.fn() }) }));
vi.mock("@/components/shared/CheckoutLayout", () => ({ CheckoutLayout: ({ price }: { price: number }) => <div role="status">{price}</div> }));
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
