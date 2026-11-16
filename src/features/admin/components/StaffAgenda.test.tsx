// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StaffAgenda } from "./StaffAgenda";
import { saveAgendaNoteAction } from "@/features/admin/agenda-note-actions";
import type { StaffAgendaDay } from "@/lib/supabase-helpers/event-agenda-notes";
vi.mock("@/features/admin/agenda-note-actions", () => ({ saveAgendaNoteAction: vi.fn() }));
vi.mock("@/features/admin/volunteer-schedule-actions", () => ({ createVolunteerScheduleAction: vi.fn() }));
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
const days: StaffAgendaDay[] = [{ id: "day", date: "2026-11-20", title: "Opening day", location: { type: "in_person", restricted: false, building: "Day building", room: "Day room" }, items: [
  { id: "first", title: "Workshop", starts_at: "2026-11-20T18:00:00Z", ends_at: "2026-11-20T19:00:00Z", location: null, check_in: true, note: { item_id: "first", body: "Saved note", revision: 1 } },
  { id: "second", title: "Lunch", starts_at: "2026-11-20T19:00:00Z", ends_at: "2026-11-20T20:00:00Z", location: null, check_in: false, note: { item_id: "second", body: "", revision: 0 } },
] }];
function setup() { render(<StaffAgenda eventId="event" eventName="UXathon" days={days} initialDayId="day" volunteerUrl={null} />); }
function edit() { fireEvent.click(screen.getAllByRole("button", { name: "View Notes" })[0]); return screen.getByRole("textbox", { name: "Staff note" }) as HTMLTextAreaElement; }
it("inherits locations, keeps conditional exact check-in links, and cancels without saving", () => {
  setup();
  expect(screen.getByRole("link", { name: "Check In" }).getAttribute("href")).toBe("/admin/events/event/check-in?item=first");
  expect(screen.queryByRole("link", { name: "View Volunteer Schedule" })).toBeNull();
  expect(screen.getAllByText("Day building, Day room")).toHaveLength(2);
  expect(edit().value).toBe("Saved note");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(edit().value).toBe("Saved note");
  expect(saveAgendaNoteAction).not.toHaveBeenCalled();
});
it("retains long unsaved text on network failure, prevents duplicate saves, and reopens committed text", async () => {
  setup(); const text = "Long 📝 note\n".repeat(1000); edit();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  let resolve!: (value: Awaited<ReturnType<typeof saveAgendaNoteAction>>) => void;
  vi.mocked(saveAgendaNoteAction).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(saveAgendaNoteAction).toHaveBeenCalledTimes(1);
  resolve({ ok: false, error: "Try again" });
  await screen.findByRole("alert");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(text);
  vi.mocked(saveAgendaNoteAction).mockResolvedValueOnce({ ok: true, note: { item_id: "first", body: text, revision: 2 } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(edit().value).toBe(text);
});
it("shows conflicts without replacing local text and requires explicit reconciliation before retry", async () => {
  setup(); edit(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "My edits" } });
  vi.mocked(saveAgendaNoteAction).mockResolvedValueOnce({ ok: false, error: "Changed", current: { item_id: "first", body: "Other operator", revision: 2 } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Other operator");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("My edits");
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Keep my text and use latest revision" }));
  vi.mocked(saveAgendaNoteAction).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("alert");
  expect(saveAgendaNoteAction).toHaveBeenLastCalledWith({ eventId: "event", itemId: "first", body: "My edits", expectedRevision: 2 });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("My edits");
});
it("closes the row popover when opening the editor", async () => {
  setup(); fireEvent.click(screen.getByRole("button", { name: "Actions for Workshop" }));
  const popover = await screen.findByRole("dialog", { name: "Actions for Workshop" });
  fireEvent.click(popover.querySelector("button")!);
  expect(await screen.findByRole("textbox", { name: "Staff note" })).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "Actions for Workshop" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions for Workshop" })));
});

it("shows the selected day context and optional staff resource without adding table columns", () => {
  const later = { ...days[0], id: "later", date: "2026-12-20", title: "Closing day", items: [] };
  render(<StaffAgenda eventId="event" eventName="UXathon" days={[...days, later]} initialDayId="later" volunteerUrl="https://example.com/staff" />);
  expect(screen.getByRole("combobox", { name: "Day" }).textContent).toContain("Closing day");
  expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Closing day");
  expect(screen.getByText("No agenda items for this day yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View Volunteer Schedule" }).getAttribute("href")).toBe("https://example.com/staff");
  expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();
  expect(screen.queryByText("Day", { selector: "label" })).toBeNull();
  expect(screen.queryByText("All times are Pacific Time")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Agenda" })).toBeNull();
  expect(screen.getByRole("link", { name: "Back to Event overview" }).getAttribute("href")).toBe("/admin/events/event");
  const schedule = screen.getByRole("link", { name: "View Volunteer Schedule" });
  expect(schedule.getAttribute("target")).toBe("_blank");
  expect(schedule.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getByRole("combobox").compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});


it("shows the configured schedule independently for a single day without full location details", () => {
  render(<StaffAgenda eventId="event" eventName="UXathon" days={[{ ...days[0], location: { type: "in_person", restricted: false, building: "Day building", room: "Day room", address: "Private full address", map_url: "https://example.com/map" } }]} initialDayId="day" volunteerUrl="https://example.com/staff" />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("link", { name: "View Volunteer Schedule" }).getAttribute("href")).toBe("https://example.com/staff");
  expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Opening day");
  expect(screen.queryByText("Private full address")).toBeNull();
  expect(screen.queryByRole("link", { name: /map/i })).toBeNull();
  expect(screen.getAllByText("Day building, Day room")).toHaveLength(2);
});

it("offers the initial schedule on single-day and empty agendas and removes the padded outer card", () => {
  const { container, rerender } = render(<StaffAgenda eventId="event" eventName="UXathon" days={days} initialDayId="day" volunteerUrl={null} />);
  expect(screen.getByRole("button", { name: "Add Exec Volunteer Schedule" })).toBeTruthy();
  const wrapper = container.querySelector("[data-agenda-container]")!;
  expect(wrapper.className).toBe("@container/agenda min-w-0");
  expect(wrapper.querySelector("table")).toBeTruthy();
  rerender(<StaffAgenda eventId="event" eventName="UXathon" days={[]} initialDayId={null} volunteerUrl={null} />);
  expect(screen.getByText("No agenda days yet. Add days and items in the event builder.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add Exec Volunteer Schedule" })).toBeTruthy();
});
