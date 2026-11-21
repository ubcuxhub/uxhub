// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutLayout } from "./CheckoutLayout";
import { CheckoutPaymentSection } from "./CheckoutPaymentSection";
import type { UserInfoRow } from "@/lib/supabase/models";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/features/payments/actions", () => ({ submitCheckoutAction: vi.fn() }));
vi.mock("@square/web-sdk", () => ({ payments: vi.fn() }));
afterEach(cleanup);
const buyer = { initialEmail: "member@example.test", initialFirstName: "Demo", initialLastName: "Member", userId: "user-1", slug: "demo", disabled: true };

describe("checkout composites", () => {
  it.each([true, false])("renders cardless event registration with framed=%s", framed => {
    render(<CheckoutPaymentSection {...buyer} amount="$0.00" amountCents={0} kind="event_ticket" title="Confirm registration" framed={framed} />);
    expect(screen.getByRole("button", { name: "Confirm spot" })).toBeTruthy();
    expect(screen.getByText(/No payment details are needed/)).toBeTruthy();
    expect(screen.queryByText(/Square securely/)).toBeNull();
    expect(screen.queryByLabelText("First name")).toBeNull();
  });
  it("preserves the membership payment form even at zero dollars", () => {
    render(<CheckoutPaymentSection {...buyer} amount="$0.00" amountCents={0} kind="membership" />);
    expect(screen.getByLabelText("First name")).toBeTruthy();
    expect(screen.getByText(/Square securely/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm spot" })).toBeNull();
  });
  it("keeps the free registration summary and action in the checkout layout", () => {
    const user = { id: "user-1", email: buyer.initialEmail, first_name: "Demo", last_name: "Member" } as UserInfoRow;
    render(<CheckoutLayout backAction={<button>Back</button>} description="Review your ticket." item={{ name: "Design Sprint" }} payment={{ disabled: true, kind: "event_ticket", slug: "demo", successHref: () => "/demo" }} price={0} processingMessage="Confirming registration." user={user} />);
    expect(screen.getByRole("heading", { name: "Confirm registration" })).toBeTruthy();
    expect(screen.getByText("Order summary")).toBeTruthy();
    expect(screen.getByText("Design Sprint")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm spot" })).toBeTruthy();
  });
});
