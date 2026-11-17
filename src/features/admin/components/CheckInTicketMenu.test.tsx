// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  regenerateTicketQrAction: vi.fn(),
  voidTicketAction: vi.fn(),
}));
vi.mock("@/features/admin/actions", () => actions);
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CheckInTicketMenu } from "./CheckInTicketMenu";

const attendee = { id: "ticket-1", user_id: "user-1", user_name: "Ada Lovelace", user_email: "ada@example.test" };

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function choose(item: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: "Ticket actions for Ada Lovelace" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

describe("CheckInTicketMenu", () => {
  it("voids the ticket after confirmation and drops the row", async () => {
    actions.voidTicketAction.mockResolvedValue({ ok: true });
    const onVoided = vi.fn();
    render(<CheckInTicketMenu attendee={attendee} onVoided={onVoided} />);

    choose("Void ticket");
    expect(actions.voidTicketAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Void ticket" }));

    await waitFor(() => expect(onVoided).toHaveBeenCalledWith("ticket-1"));
    expect(actions.voidTicketAction).toHaveBeenCalledWith("ticket-1");
  });

  it("shows why the server refused a void and keeps the row", async () => {
    actions.voidTicketAction.mockResolvedValue({ ok: false, error: "This ticket has been checked in." });
    const onVoided = vi.fn();
    render(<CheckInTicketMenu attendee={attendee} onVoided={onVoided} />);

    choose("Void ticket");
    fireEvent.click(screen.getByRole("button", { name: "Void ticket" }));

    expect(await screen.findByText("This ticket has been checked in.")).toBeTruthy();
    expect(onVoided).not.toHaveBeenCalled();
  });

  it("regenerates the QR code after confirmation", async () => {
    actions.regenerateTicketQrAction.mockResolvedValue({ ok: true });
    render(<CheckInTicketMenu attendee={attendee} onVoided={vi.fn()} />);

    choose("Regenerate QR code");
    fireEvent.click(screen.getByRole("button", { name: "Regenerate code" }));

    await waitFor(() => expect(actions.regenerateTicketQrAction).toHaveBeenCalledWith("ticket-1"));
  });
});
