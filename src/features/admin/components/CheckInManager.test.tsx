// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formatEventTime } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { ItemCheckInSnapshot } from "@/features/admin/lib/item-check-in";
const actions = vi.hoisted(() => ({ fetchItemCheckInAction: vi.fn(), mutateItemCheckInAction: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));
vi.mock("@/features/admin/check-in-actions", () => actions);
vi.mock("./CheckInTicketMenu", () => ({
  CheckInTicketMenu: ({ onVoided }: { onVoided: (id: string) => void }) => <button onClick={() => onVoided("ticket")}>Void attendee ticket</button>,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };

      return ch;
    }, removeChannel: vi.fn()
  })
}));
import { CheckInManager } from "./CheckInManager";
const snapshot: ItemCheckInSnapshot = { items: [{ id: "a", label: "Opening", starts_at: "2026-11-15T19:00:00Z", ends_at: "2026-11-15T20:00:00Z" }], attendees: [{ id: "ticket", user_id: "user", user_name: "Ada Lovelace", user_email: "ada@test" }], attendance: [] };
const row = { ticketId: "ticket", attendanceVersion: "version", checkedInAt: "2026-11-15T19:00:00Z", operator: "Morgan", method: "manual" as const };
const event = { id: "event", name: "Design Sprint" } as EventRow;
beforeEach(() => {
  vi.clearAllMocks();

  actions.fetchItemCheckInAction.mockResolvedValue(snapshot);

  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

  window.history.replaceState(null, "", "/admin/events/event/check-in?item=a");
});

afterEach(cleanup);
function mount(initial = snapshot, item: string | null = "a") {
  return render(<CheckInManager eventId="event" event={event} initialItemId={item} initialSnapshot={initial} phoneLinks={{ a: <svg aria-label="Phone scanner QR" /> }} />);
}
it("retains selected target in scanner and phone QR paths", async () => {
  mount();

  await act(async () => { });

  expect(screen.getByRole("link", { name: "Scan tickets" }).getAttribute("href")).toBe("/admin/events/event/check-in/scan?item=a");

  fireEvent.click(screen.getByRole("button", { name: "Open scanner on phone" }));

  expect(screen.getByLabelText("Phone scanner QR")).toBeTruthy();
});
it("checks in manually, refreshes counts/filter/activity and binds toast undo to that version", async () => {
  mount();

  await act(async () => { });

  actions.mutateItemCheckInAction.mockResolvedValue({ status: "checked_in", name: "Ada Lovelace", ...row, checkedCount: 1, total: 1 });

  actions.fetchItemCheckInAction.mockResolvedValue({ ...snapshot, attendance: [row] });
  fireEvent.click(screen.getByRole("button", { name: "Check in" }));

  await waitFor(() => expect(toast.success).toHaveBeenCalled());

  expect(screen.getByText("Checked in manually · Morgan")).toBeTruthy();

  expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
  expect(toast.success.mock.calls[0][1].description).toBe("Opening · 1 of 1 checked in");

  actions.mutateItemCheckInAction.mockResolvedValue({ status: "undone" });

  actions.fetchItemCheckInAction.mockResolvedValue(snapshot);
  await act(async () => toast.success.mock.calls[0][1].action.onClick());

  expect(actions.mutateItemCheckInAction).toHaveBeenLastCalledWith({ eventId: "event", itemId: "a", ticketId: "ticket", undoVersion: "version" });
});
it("row confirmation Cancel preserves attendance; stale undo leaves a visible error", async () => {
  actions.fetchItemCheckInAction.mockResolvedValue({ ...snapshot, attendance: [row] });

  mount({ ...snapshot, attendance: [row] });

  await act(async () => { });
  fireEvent.click(screen.getByRole("button", { name: "Undo check-in for Ada Lovelace" }));

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(actions.mutateItemCheckInAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Undo check-in for Ada Lovelace" }));

  actions.mutateItemCheckInAction.mockResolvedValue({ status: "stale_undo" });

  fireEvent.click(screen.getByRole("button", { name: /^Undo check-in$/ }));

  await waitFor(() => expect(screen.getByText(/This check-in changed/)).toBeTruthy());
});
it("shows unavailable selection without any enabled mutations", async () => {
  mount(snapshot, null);

  await act(async () => { });

  expect(screen.getByText("This check-in item is unavailable.")).toBeTruthy();

  expect(screen.queryByRole("link", { name: "Scan tickets" })).toBeNull();
});
it("does not report success if a saved check-in cannot refresh", async () => {
  mount();

  await act(async () => { });

  actions.mutateItemCheckInAction.mockResolvedValue({ status: "checked_in", name: "Ada", ...row, checkedCount: 1, total: 1 });

  actions.fetchItemCheckInAction.mockRejectedValue(new Error("network"));

  fireEvent.click(screen.getByRole("button", { name: "Check in" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("saved, but the list couldn't refresh")));

  expect(toast.success).not.toHaveBeenCalled();
});

it("never describes a rejected ticket as a saved change when refresh fails", async () => {
  mount();

  await act(async () => { });
  actions.mutateItemCheckInAction.mockResolvedValue({ status: "rejected", reason: "not_found" });
  actions.fetchItemCheckInAction.mockRejectedValue(new Error("network"));
  fireEvent.click(screen.getByRole("button", { name: "Check in" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't refresh the check-in list. Try again before another action."));
  expect(toast.success).not.toHaveBeenCalled();
});

it("a toast from an unmounted overview cannot issue a late undo", async () => {
  const view = mount(); await act(async () => {});
  actions.mutateItemCheckInAction.mockResolvedValue({status:"checked_in",name:"Ada",...row,checkedCount:1,total:1});
  actions.fetchItemCheckInAction.mockResolvedValue({...snapshot,attendance:[row]});
  fireEvent.click(screen.getByRole("button",{name:"Check in"}));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  view.unmount();
  await act(async () => toast.success.mock.calls[0][1].action.onClick());
  expect(actions.mutateItemCheckInAction).toHaveBeenCalledTimes(1);
});

it("shows one timestamp badge for checked attendees and no Going badges", async () => {
  actions.fetchItemCheckInAction.mockResolvedValue({ ...snapshot, attendance: [row] });
  mount({ ...snapshot, attendance: [row] });
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: /^All/ }));
  const badge = screen.getByText(`Checked in at ${formatEventTime(row.checkedInAt)}`);
  expect(badge.querySelector("svg")).toBeTruthy();
  expect(screen.queryByText("Going", { exact: true })).toBeNull();
  expect(screen.getAllByText(`Checked in at ${formatEventTime(row.checkedInAt)}`)).toHaveLength(1);
});
it("retains agenda origin in Back and scanner links after a refresh", async () => {
  const returnTo = "/admin/events/event/agenda?day=second";
  const props = { eventId: "event", event, initialItemId: "a", initialSnapshot: snapshot, phoneLinks: {}, returnTo };
  const view = render(<CheckInManager {...props} />);
  await act(async () => {});
  expect(screen.getByRole("link", { name: "Back to Agenda" }).getAttribute("href")).toBe(returnTo);
  const scan = screen.getByRole("link", { name: "Scan tickets" }).getAttribute("href")!;
  expect(new URL(scan, window.location.origin).searchParams.get("returnTo")).toBe(returnTo);
  view.unmount();
  window.history.replaceState(null, "", scan.replace("/scan", ""));
  render(<CheckInManager {...props} />);
  await act(async () => {});
  expect(screen.getByRole("link", { name: "Back to Agenda" }).getAttribute("href")).toBe(returnTo);
});
it("uses Manage Events for direct links and unsafe destinations", async () => {
  render(<CheckInManager eventId="event" event={event} initialItemId="a" initialSnapshot={snapshot} phoneLinks={{}} returnTo="//evil.test" />);
  await act(async () => {});
  expect(screen.getByRole("link", { name: "Back to Manage Events" }).getAttribute("href")).toBe("/admin/events");
});

it("refreshes the item attendee list and counts after a ticket is voided", async () => {
  mount();
  await act(async () => {});
  actions.fetchItemCheckInAction.mockResolvedValue({ ...snapshot, attendees: [] });
  fireEvent.click(screen.getByRole("button", { name: "Void attendee ticket" }));
  await waitFor(() => expect(screen.getByText("No attendees yet")).toBeTruthy());
  expect(screen.queryByText("Ada Lovelace")).toBeNull();
  expect(screen.getByText("0 going")).toBeTruthy();
});
