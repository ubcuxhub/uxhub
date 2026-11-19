// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EventAgendaTable } from "./EventAgendaTable";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
const day = (id: string, date: string, check_in = false): EventAgendaDay => ({ id, date, title: `Day ${id}`, location_overridden: false, location: { type: "in_person", restricted: true, public_summary: "Campus" }, items: [{ id: `item-${id}`, title: `Workshop ${id}`, starts_at: `${date}T17:00:00Z`, ends_at: `${date}T18:00:00Z`, check_in, location_overridden: false, description: id === "first" ? "Bring a laptop" : null, location: { type: "in_person", restricted: true, public_summary: "Campus" } }] });
it("renders only the Figma agenda information without extra descriptions or tags", () => {
  render(<EventAgendaTable eventName="UXathon" agenda={[day("first", "2026-11-20")]} />);
  expect(screen.getByText("All times are Pacific Time")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByText("Check-in")).toBeNull();
  expect(screen.queryByText("Bring a laptop")).toBeNull();
  expect(screen.queryByText("Happening now")).toBeNull();
  expect(screen.queryByText("Today")).toBeNull();
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Fri, Nov 20 · Day first");
  expect(screen.getByRole("columnheader", { name: "Room" })).toBeTruthy();
  expect(screen.getByRole("region", { name: /scroll for locations/ }).tabIndex).toBe(0);
});
it("gives each day its own dated tab when every day sits in a different week, without check-in tags", () => {
  render(<EventAgendaTable eventName="Mentorship" agenda={[day("first", "2026-11-20"), day("last", "2026-12-11", true)]} />);
  expect(screen.getByRole("tablist", { name: "Agenda days" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Fri, Nov 20" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Fri, Dec 11" }), { button: 0, ctrlKey: false });
  expect(screen.getByText("Workshop last")).toBeTruthy();
  expect(screen.queryByText("Check-in")).toBeNull();
  expect(screen.queryByText("Workshop first")).toBeNull();
});
it("gives each day of a weekend event its own tab", () => {
  render(<EventAgendaTable eventName="UXathon" agenda={[day("sat", "2027-01-09"), day("sun", "2027-01-10")]} />);
  expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Sat, Jan 9", "Sun, Jan 10"]);
  expect(screen.getByText("Workshop sat")).toBeTruthy();
  expect(screen.queryByText("Workshop sun")).toBeNull();
});
it("switches between week tabs when a week holds several days, stacking that week's days", () => {
  render(<EventAgendaTable eventName="Design Sprint" agenda={[day("mon", "2026-11-16"), day("wed", "2026-11-18"), day("fri", "2026-11-27")]} />);
  expect(screen.getByRole("tablist", { name: "Agenda weeks" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual(["Mon, Nov 16 · Day mon", "Wed, Nov 18 · Day wed"]);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Week 2" }), { button: 0, ctrlKey: false });
  expect(screen.getByText("Workshop fri")).toBeTruthy();
  expect(screen.queryByText("Workshop mon")).toBeNull();
});
it("opens on the tab holding today, or the next one", () => {
  const agenda = [day("mon", "2026-11-16"), day("wed", "2026-11-18"), day("fri", "2026-11-27")];
  const view = render(<EventAgendaTable eventName="Design Sprint" agenda={agenda} today="2026-11-27" />);
  expect(screen.getByRole("tab", { name: "Week 2" }).getAttribute("aria-selected")).toBe("true");
  view.unmount();
  render(<EventAgendaTable eventName="Design Sprint" agenda={agenda} today="2026-11-20" />);
  expect(screen.getByRole("tab", { name: "Week 2" }).getAttribute("aria-selected")).toBe("true");
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
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Sat, May 16 · Presentations");
  expect(screen.getByRole("cell", { name: "10:15–11:30 AM" })).toBeTruthy();
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
  expect(screen.getByText("10:15–11:30 AM").className).toContain("whitespace-nowrap");
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

it("names the day's venue in its heading only when the day set its own location", () => {
  const moved = day("final", "2026-11-15");
  moved.title = "Final presentations";
  moved.location_overridden = true;
  moved.location = { type: "in_person", restricted: false, building: "UBC Robson Square", room: "C300" };
  const usual = day("kickoff", "2026-11-14");
  usual.title = "Design Sprint kickoff";
  usual.location = { type: "in_person", restricted: false, building: "AMS Nest" };
  render(<EventAgendaTable eventName="Design Sprint" agenda={[usual, moved]} />);
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Sat, Nov 14 · Design Sprint kickoff");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Sun, Nov 15" }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Sun, Nov 15 · Final presentations · UBC Robson Square");
});
it("links an item's title to its resource in a new tab, leaving other items plain", () => {
  const entry = day("final", "2026-11-28");
  entry.items.push({ ...entry.items[0], id: "item-lunch", title: "Lunch" });
  render(<EventAgendaTable eventName="Design Sprint" agenda={[entry]} itemLinks={{ "item-final": "https://example.test/slides" }} />);
  const link = screen.getByRole("link", { name: /^Workshop final\s*\(opens in a new tab\)$/ });
  expect(link.getAttribute("href")).toBe("https://example.test/slides");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
