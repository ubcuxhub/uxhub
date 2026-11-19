// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EventAgendaTable } from "./EventAgendaTable";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
const day = (id: string, date: string, check_in = false): EventAgendaDay => ({ id, date, title: `Day ${id}`, location: { type: "in_person", restricted: true, public_summary: "Campus" }, items: [{ id: `item-${id}`, title: `Workshop ${id}`, starts_at: `${date}T17:00:00Z`, ends_at: `${date}T18:00:00Z`, check_in, location_overridden: false, description: id === "first" ? "Bring a laptop" : null, location: { type: "in_person", restricted: true, public_summary: "Campus" } }] });
it("renders only the Figma agenda information without extra descriptions or tags", () => {
  render(<EventAgendaTable eventName="UXathon" agenda={[day("first", "2026-11-20")]} />);
  expect(screen.getByText("All times are Pacific Time")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByText("Check-in")).toBeNull();
  expect(screen.queryByText("Bring a laptop")).toBeNull();
  expect(screen.queryByText("Happening now")).toBeNull();
  expect(screen.queryByText("Today")).toBeNull();
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Fri, Nov 20th · Day first");
  expect(screen.getByRole("columnheader", { name: "Room" })).toBeTruthy();
  expect(screen.getByRole("region", { name: /scroll for locations/ }).tabIndex).toBe(0);
});
it("switches between dated nonconsecutive weeks without adding check-in tags", () => {
  render(<EventAgendaTable eventName="UXathon" agenda={[day("first", "2026-11-20"), day("last", "2026-12-11", true)]} />);
  expect(screen.getByRole("tab", { name: "Week 1" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Week 4" }), { button: 0, ctrlKey: false });
  expect(screen.getByText("Workshop last")).toBeTruthy();
  expect(screen.queryByText("Check-in")).toBeNull();
  expect(screen.queryByText("Workshop first")).toBeNull();
});
it("omits an empty agenda", () => {
  const { container } = render(<EventAgendaTable eventName="UXathon" agenda={[]} />);
  expect(container.textContent).toBe("");
});

it("keeps day locations and meeting details out of the agenda header and rows", () => {
  const entry = day("first", "2026-05-16", true);
  entry.title = "Presentations";
  entry.location = { type: "hybrid", restricted: false, building: "Day building", address: "Day address", meeting_passcode: "Day passcode" };
  entry.items[0] = { ...entry.items[0], starts_at: "2026-05-16T17:15:00Z", ends_at: "2026-05-16T18:30:00Z", location_overridden: true, location: { type: "hybrid", restricted: false, building: "Innovation Center", room: "Main Hall", address: "Hidden street address", meeting_url: "https://example.com/join", meeting_id: "Hidden meeting ID", meeting_passcode: "Hidden passcode" } };
  render(<EventAgendaTable eventName="UXathon" agenda={[entry]} />);
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Sat, May 16th · Presentations");
  expect(screen.getByRole("cell", { name: "10:15 AM – 11:30 AM" })).toBeTruthy();
  expect(screen.getByText("Innovation Center")).toBeTruthy();
  expect(screen.getByText("Main Hall")).toBeTruthy();
  for (const text of ["Day building", "Day address", "Day passcode", "Hidden street address", "Hidden meeting ID", "Hidden passcode", "Bring a laptop", "Check-in", "Happening now", "Today"]) {
    expect(screen.queryByText(text)).toBeNull();
  }
  expect(screen.queryByRole("link")).toBeNull();
});

it("keeps each time together and includes the compact location with its item label", () => {
  const entry = day("first", "2026-05-16");
  entry.items[0] = { ...entry.items[0], starts_at: "2026-05-16T17:15:00Z", ends_at: "2026-05-16T18:30:00Z", location: { type: "in_person", restricted: false, building: "Innovation Center", room: "Studio A" } };
  render(<EventAgendaTable eventName="UXathon" agenda={[entry]} />);
  expect(screen.getByText("10:15 AM –")).toBeTruthy();
  expect(screen.getByText("11:30 AM")).toBeTruthy();
  const cell = screen.getByText("Workshop first").closest("td")!;
  expect(within(cell).getByText("Innovation Center, Studio A")).toBeTruthy();
});
it("uses only the public summary in the compact location for a restricted viewer", () => {
  const entry = day("first", "2026-05-16");
  entry.items[0].location = { type: "hybrid", restricted: true, public_summary: "UBC campus", building: "Private building", room: "Private room" };
  render(<EventAgendaTable eventName="UXathon" agenda={[entry]} />);
  const cell = screen.getByText("Workshop first").closest("td")!;
  expect(within(cell).getByText("UBC campus")).toBeTruthy();
  expect(screen.queryByText(/Private/)).toBeNull();
});
