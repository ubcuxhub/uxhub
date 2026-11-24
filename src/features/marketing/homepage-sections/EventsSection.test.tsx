// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ flags: { studentEvents: true }, list: vi.fn(), warn: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/flags", () => ({ FLAGS: mocks.flags }));
vi.mock("@/lib/log", () => ({ log: { warn: mocks.warn }, errorFields: () => ({}) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => "public-client" }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEvents: mocks.list }));

import EventsSection from "./EventsSection";

const event = (id: string, starts_at: string) => ({
  id, slug: id, name: `Event ${id}`, starts_at, ends_at: null, location_building: null, location_room: null,
  image_url: null, canceled_at: null, configured_marketing_mode: "hosted", configured_marketing_url: null, marketing_url: null,
});

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.flags.studentEvents = true;
  mocks.list.mockResolvedValue([]);
});

it("says events are coming soon while student events are off, without reading any", async () => {
  mocks.flags.studentEvents = false;
  render(await EventsSection());
  expect(screen.getByText("Events are coming soon.")).toBeTruthy();
  expect(screen.getByRole("link", { name: /LINKTREE/ })).toBeTruthy();
  expect(mocks.list).not.toHaveBeenCalled();
});

it("previews the next three upcoming events and links to /events once launched", async () => {
  mocks.list.mockResolvedValue([
    event("past", "2020-01-01T18:00:00Z"),
    ...["a", "b", "c", "d"].map((id, i) => event(id, `2099-0${i + 1}-01T18:00:00Z`)),
  ]);
  render(await EventsSection());
  expect(screen.queryByText("Events are coming soon.")).toBeNull();
  expect(screen.getAllByText(/^Event /).map((node) => node.textContent)).toEqual(["Event a", "Event b", "Event c"]);
  expect(screen.getByRole("link", { name: /ALL EVENTS/ }).getAttribute("href")).toMatch(/^\/events/);
});

it("still links to /events when the events can't be read", async () => {
  mocks.list.mockRejectedValue(new Error("offline"));
  render(await EventsSection());
  expect(mocks.warn).toHaveBeenCalledWith("marketing.homepage_events_failed", {});
  expect(screen.getByRole("link", { name: /ALL EVENTS/ })).toBeTruthy();
});
