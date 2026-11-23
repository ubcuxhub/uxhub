// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ItemCheckInSnapshot } from "@/features/admin/lib/item-check-in";
const actions = vi.hoisted(() => ({ fetchItemCheckInAction: vi.fn(), mutateItemCheckInAction: vi.fn() }));
const camera = vi.hoisted(() => ({ scan: vi.fn<(code: string) => void>() as (code: string) => void, problem: vi.fn() as (problem: string | null) => void, unmount: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));
vi.mock("@/features/admin/check-in-actions", () => actions);
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };

      return ch;
    }, removeChannel: vi.fn()
  })
}));
vi.mock("./QrCameraView", async () => {
  const { useEffect } = await import("react");

  return {
    QrCameraView: ({ onScan, onProblemChange }: { onScan: (code: string) => void; onProblemChange: (problem: string | null) => void }) => {
      camera.scan = onScan;
      camera.problem = onProblemChange;

      useEffect(() => () => camera.unmount(), []);

      return <div data-testid="camera" />;
    }
  };
});
vi.mock("./CheckInTarget", () => ({
  checkInItemContext: () => "Nov 21 · 10:00 AM – 11:00 AM PT", CheckInTarget: ({ itemId, onChange }: { itemId: string; onChange: (id: string) => void }) => <select aria-label="Check-in item" value={itemId ?? ""} onChange={e => onChange(e.target.value)}>
    <option value="">Choose</option>
    <option value="a">Opening</option>
    <option value="b">Closing</option>
  </select>
}));
import { CheckInScanner } from "./CheckInScanner";
const snapshot: ItemCheckInSnapshot = { items: [{ id: "a", label: "Opening", starts_at: null, ends_at: null }, { id: "b", label: "Closing", starts_at: null, ends_at: null }], attendees: [{ id: "ticket", user_id: "user", user_name: "Ada Lovelace", user_email: "ada@test" }], attendance: [] };
const result = { status: "checked_in", name: "Ada Lovelace", ticketId: "ticket", attendanceVersion: "v1", checkedInAt: "2026-11-15T19:00:00Z", checkedCount: 1, total: 1 };
beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

  window.history.replaceState(null, "", "/admin/events/event/check-in/scan?item=a");

  actions.fetchItemCheckInAction.mockResolvedValue(snapshot);

  actions.mutateItemCheckInAction.mockResolvedValue(result);
});
afterEach(() => {
  cleanup();

  vi.useRealTimers();
});
function mount() {
  return render(<CheckInScanner eventId="event" eventName="Design Sprint" initialItemId="a" initialSnapshot={snapshot} />);
}
const hint = () => screen.getByRole("region", { name: "Point the camera at the attendee’s QR code." });
const announced = (text: string) => screen.getAllByRole("status").some(node => node.textContent?.includes(text));
it("uses the selected item, announces the result, and returns to scanning after four seconds", async () => {
  mount();

  await waitFor(() => expect(actions.fetchItemCheckInAction).toHaveBeenCalled());
  vi.useFakeTimers();

  await act(async () => camera.scan("qr"));
  expect(actions.mutateItemCheckInAction).toHaveBeenCalledWith({ eventId: "event", itemId: "a", code: "qr" });
  expect(screen.getByRole("heading", { name: "Checked in" })).toBeTruthy();
  expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  expect(screen.getByText(/Next scan in 4 seconds/)).toBeTruthy();
  expect(announced("Checked in: Ada Lovelace. 1 of 1 checked in.")).toBe(true);
  expect(screen.queryByTestId("camera")).toBeNull();

  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  expect(screen.getByText(/Next scan in 1 second$/)).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.queryByText("Ada Lovelace")).toBeNull();
  expect(screen.getByTestId("camera")).toBeTruthy();
  // The countdown ran out on its own, so focus stays where it was.
  expect(document.activeElement).toBe(document.body);
});
it("skips the wait with Scan next and moves focus back to the camera", async () => {
  mount();

  await act(async () => { });
  await act(async () => camera.scan("qr"));
  fireEvent.click(screen.getByRole("button", { name: "Scan next" }));

  expect(screen.queryByText("Ada Lovelace")).toBeNull();
  expect(screen.getByTestId("camera")).toBeTruthy();
  expect(document.activeElement).toBe(hint());
});
it("holds the countdown while focus or the pointer is in the result", async () => {
  mount();

  await act(async () => { });
  vi.useFakeTimers();
  await act(async () => camera.scan("qr"));
  const undo = screen.getByRole("button", { name: "Undo check-in" });
  act(() => undo.focus());
  await act(async () => {
    vi.advanceTimersByTime(6000);
  });
  expect(screen.getByText(/Next scan paused/)).toBeTruthy();
  act(() => undo.blur());
  fireEvent.pointerEnter(undo);
  await act(async () => {
    vi.advanceTimersByTime(6000);
  });
  expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  fireEvent.pointerLeave(undo);
  await act(async () => {
    vi.advanceTimersByTime(4000);
  });
  expect(screen.queryByText("Ada Lovelace")).toBeNull();
});
it("ignores the same code for three seconds after returning to scanning", async () => {
  mount();

  await act(async () => { });
  vi.useFakeTimers();
  await act(async () => camera.scan("qr"));
  fireEvent.click(screen.getByRole("button", { name: "Scan next" }));

  await act(async () => camera.scan("qr"));
  expect(actions.mutateItemCheckInAction).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("camera")).toBeTruthy();

  await act(async () => {
    vi.advanceTimersByTime(3001);
  });
  await act(async () => camera.scan("qr"));
  expect(actions.mutateItemCheckInAction).toHaveBeenCalledTimes(2);
});
it("checks another code during the cooldown", async () => {
  mount();

  await act(async () => { });
  await act(async () => camera.scan("qr"));
  fireEvent.click(screen.getByRole("button", { name: "Scan next" }));
  await act(async () => camera.scan("other"));
  expect(actions.mutateItemCheckInAction).toHaveBeenLastCalledWith({ eventId: "event", itemId: "a", code: "other" });
});
it("confirms an undo, holds the countdown meanwhile, and returns to the camera", async () => {
  mount();

  await act(async () => { });
  vi.useFakeTimers();
  await act(async () => camera.scan("qr"));
  fireEvent.click(screen.getByRole("button", { name: "Undo check-in" }));
  const dialog = screen.getByRole("dialog", { name: "Undo check-in" });
  expect(dialog.textContent).toContain("Ada Lovelace will go back to Going for Opening.");

  await act(async () => {
    vi.advanceTimersByTime(6000);
  });
  expect(screen.getByText("Ada Lovelace")).toBeTruthy();

  actions.mutateItemCheckInAction.mockResolvedValue({ status: "undone" });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Undo check-in" }));
  });
  expect(actions.mutateItemCheckInAction).toHaveBeenLastCalledWith({ eventId: "event", itemId: "a", ticketId: "ticket", undoVersion: "v1" });
  expect(toast.success).toHaveBeenCalledWith("Check-in undone");
  expect(screen.getByTestId("camera")).toBeTruthy();
  expect(announced("Check-in undone for Ada Lovelace.")).toBe(true);
});
it("hides the scanner's own hint and search when the camera reports a problem", async () => {
  mount();

  await act(async () => { });
  act(() => camera.problem("blocked"));
  expect(screen.queryByText("Point the camera at the attendee’s QR code.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Search attendees" })).toBeNull();
  act(() => camera.problem(null));
  expect(hint()).toBeTruthy();
});
it("ignores a delayed scan result after changing items and retains the new return link", async () => {
  let finish!: (value: unknown) => void;

  actions.mutateItemCheckInAction.mockImplementation(() => new Promise(resolve => {
    finish = resolve;
  }));

  mount();

  await act(async () => { });
  act(() => camera.scan("qr"));

  fireEvent.change(screen.getByRole("combobox", { name: "Check-in item" }), { target: { value: "b" } });
  await act(async () => finish(result));

  expect(screen.queryByText("Ada Lovelace")).toBeNull();

  expect(screen.getByRole("link", { name: "Close scanner" }).getAttribute("href")).toContain("?item=b");

  expect(window.location.search).toBe("?item=b");
});
it("stops the camera offline, prevents manual writes, and refetches on reconnect", async () => {
  mount();

  await act(async () => { });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.queryByTestId("camera")).toBeNull();

  expect(camera.unmount).toHaveBeenCalled();

  await act(async () => camera.scan("qr"));

  expect(actions.mutateItemCheckInAction).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });

  act(() => window.dispatchEvent(new Event("online")));

  await waitFor(() => expect(screen.getByTestId("camera")).toBeTruthy());

  expect(actions.fetchItemCheckInAction.mock.calls.length).toBeGreaterThan(1);
});
it("offers search recovery for unrecognised tickets without losing target", async () => {
  actions.mutateItemCheckInAction.mockResolvedValue({ status: "rejected", reason: "not_found" });

  mount();

  await act(async () => { });

  await act(async () => camera.scan("bad"));
  fireEvent.click(screen.getAllByRole("button", { name: "Search attendees" }).at(-1)!);

  expect(screen.getByRole("searchbox", { name: "Search by name or email" })).toBeTruthy();

  expect(window.location.search).toBe("?item=a");
});
it("discards an in-flight result when connectivity is lost", async () => {
  let finish!: (value: unknown) => void;

  actions.mutateItemCheckInAction.mockImplementation(() => new Promise(resolve => {
    finish = resolve;
  }));

  mount();

  await act(async () => { });

  act(() => camera.scan("qr"));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

  act(() => window.dispatchEvent(new Event("offline")));

  await act(async () => finish(result));

  expect(screen.queryByText("Ada Lovelace")).toBeNull();
});

it("shows a repeat scan with the committed count, no undo and no wait", async () => {
  actions.mutateItemCheckInAction.mockResolvedValue({ ...result, status: "already_checked_in", checkedInAt: "2026-11-01T18:00:00Z" });
  actions.fetchItemCheckInAction.mockResolvedValue({ ...snapshot, attendance: [{ ticketId: "ticket", attendanceVersion: "v1", checkedInAt: "2026-11-01T18:00:00Z", operator: null, method: "scan" }] });

  mount();

  await act(async () => { });

  await act(async () => camera.scan("again"));
  expect(screen.getByRole("heading", { name: "Already checked in" })).toBeTruthy();
  expect(screen.getByText(/Nothing changed, so the count stays the same\./)).toBeTruthy();
  expect(screen.getByText("Design Sprint · 1 of 1 checked in")).toBeTruthy();

  expect(screen.queryByRole("button", { name: "Undo check-in" })).toBeNull();
  expect((screen.getByRole("button", { name: "Scan next" }) as HTMLButtonElement).disabled).toBe(false);
});
it("retains target and blocks capture after permission is lost", async () => {
  actions.fetchItemCheckInAction.mockResolvedValue({ status: "forbidden" });

  mount();

  await waitFor(() => expect(screen.getByText("You no longer have access to check-in.")).toBeTruthy());

  expect(screen.queryByTestId("camera")).toBeNull();

  expect(window.location.search).toBe("?item=a");
});

it("Scan next returns manual lookup to the camera", async () => {
  mount(); await act(async () => {});
  fireEvent.click(screen.getByRole("button", {name:"Search attendees"}));
  fireEvent.change(screen.getByRole("searchbox", {name:"Search by name or email"}), {target:{value:"Ada"}});
  fireEvent.click(screen.getByRole("button", {name:"Check in Ada Lovelace"}));
  await act(async () => {});
  expect(actions.mutateItemCheckInAction).toHaveBeenCalledWith({ eventId: "event", itemId: "a", ticketId: "ticket" });
  fireEvent.click(screen.getByRole("button", {name:"Scan next"}));
  expect(screen.getByTestId("camera")).toBeTruthy();
  expect(screen.queryByRole("searchbox", {name:"Search by name or email"})).toBeNull();
});

it("keeps the agenda day through item changes, refresh and scanner close", async () => {
  const returnTo = "/admin/events/event/agenda?day=second";
  const props = { eventId: "event", eventName: "Design Sprint", initialItemId: "a", initialSnapshot: snapshot, returnTo };
  const view = render(<CheckInScanner {...props} />);
  await act(async () => {});
  fireEvent.change(screen.getByRole("combobox", { name: "Check-in item" }), { target: { value: "b" } });
  await act(async () => {});
  expect(new URL(window.location.href).searchParams.get("item")).toBe("b");
  expect(new URL(window.location.href).searchParams.get("returnTo")).toBe(returnTo);
  view.unmount();
  render(<CheckInScanner {...props} initialItemId="b" />);
  await act(async () => {});
  const href = screen.getByRole("link", { name: "Close scanner" }).getAttribute("href")!;
  const query = new URL(href, window.location.origin).searchParams;
  expect(query.get("item")).toBe("b");
  expect(query.get("returnTo")).toBe(returnTo);
});

it("explains cancellation when the item check-in is refused", async () => {
  actions.mutateItemCheckInAction.mockResolvedValue({ status: "rejected", reason: "event_canceled" });
  mount();
  await act(async () => { });
  await act(async () => camera.scan("qr"));
  expect(screen.getByRole("heading", { name: "This event is canceled" })).toBeTruthy();
  expect(screen.getByText("Canceled events don’t take check-ins.")).toBeTruthy();
  expect(screen.queryByText("Ticket not recognized")).toBeNull();
  expect(screen.queryByRole("button", { name: "Search attendees" })).toBeNull();
});
