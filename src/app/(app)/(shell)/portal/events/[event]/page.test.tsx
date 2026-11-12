// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  badge: "going",
  sign: vi.fn(() => "signed-ticket-token"),
  fetchTicket: vi.fn(),
  fetchLinks: vi.fn(),
  user: { id: "user-1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.test" },
  event: { id: "event-1", slug: "sprint", name: "Design Sprint", status: "active", starts_at: "2099-01-01T18:00:00Z", ends_at: "2099-01-01T20:00:00Z", agenda_enabled: false, mentors_enabled: false, sponsors_enabled: false, description: "An event." },
  ticket: { id: "ticket-1", event_id: "event-1", user_id: "user-1" },
}));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: async () => fixtures.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventBySlug: async () => fixtures.event }));
vi.mock("@/lib/supabase-helpers/event-agenda", () => ({ fetchEventAgenda: async () => [] }));
vi.mock("@/lib/supabase-helpers/event-people", () => ({ fetchEventMentors: async () => [], fetchEventSponsors: async () => [] }));
vi.mock("@/lib/supabase-helpers/event-tickets", () => ({ fetchUserEventTicket: fixtures.fetchTicket }));
vi.mock("@/lib/supabase-helpers/event-links", () => ({ fetchEventLinks: fixtures.fetchLinks }));
vi.mock("@/lib/check-in-token", () => ({ createCheckInToken: fixtures.sign }));
vi.mock("@/features/events/lib/event-badge", () => ({ loadEventBadges: async () => ({ "event-1": { status: fixtures.badge } }) }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/shared/FlowLink", () => ({ FlowLink: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/features/applications/components/ApplicationStatusCallout", () => ({ ApplicationStatusCallout: () => null }));
vi.mock("@/features/events/components/EventAgendaTable", () => ({ EventAgendaTable: () => null }));
vi.mock("@/features/events/components/EventPeopleCard", () => ({ EventPeopleCard: () => null }));

import PortalEventPage from "./page";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.badge = "going";
  fixtures.fetchTicket.mockResolvedValue(fixtures.ticket);
  fixtures.fetchLinks.mockResolvedValue([]);
});

it("shows a scannable ticket on the event page after registration, alongside Going", async () => {
  render(await PortalEventPage({ params: Promise.resolve({ event: "sprint" }) }));
  expect(fixtures.fetchTicket).toHaveBeenCalledWith(expect.anything(), "event-1", "user-1");
  expect(fixtures.sign).toHaveBeenCalledWith("ticket-1");
  expect(screen.getAllByText("Going").length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: /QR code/i })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Registration" })).toBeTruthy();
  expect(screen.getByText("1 ticket")).toBeTruthy();
  expect(screen.getByText("You're going to Design Sprint")).toBeTruthy();
  expect(screen.getByText("Show your ticket at check-in.")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "View participant package" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View ticket" }));
  const dialog = await screen.findByRole("dialog", { name: "Your ticket for Design Sprint" });
  expect(within(dialog).getByRole("img", { name: /QR code/i })).toBeTruthy();
});

it("does not render or sign an issued QR for an accepted applicant without a ticket", async () => {
  fixtures.fetchTicket.mockResolvedValue(null);
  fixtures.badge = "register_by";
  render(await PortalEventPage({ params: Promise.resolve({ event: "sprint" }) }));
  expect(screen.queryByRole("img", { name: /QR code/i })).toBeNull();
  expect(screen.queryByRole("button", { name: "View ticket" })).toBeNull();
  expect(fixtures.sign).not.toHaveBeenCalled();
  expect(fixtures.fetchLinks).not.toHaveBeenCalled();
});

it("shows only participant packages returned by the viewer-scoped resource helper, retaining custom labels", async () => {
  fixtures.fetchLinks.mockResolvedValue([
    { id: "package", type: "participant_package", label: "Participant package", url: "https://example.test/package" },
    { id: "second", type: "participant_package", label: "Workshop materials", url: "https://example.test/materials" },
    { id: "slack", type: "slack_workspace", label: "Slack", url: "https://example.test/slack" },
  ]);
  render(await PortalEventPage({ params: Promise.resolve({ event: "sprint" }) }));
  expect(fixtures.fetchLinks).toHaveBeenCalledWith(expect.anything(), "event-1");
  expect(screen.getByRole("link", { name: "View participant package" }).getAttribute("href")).toBe("https://example.test/package");
  expect(screen.getByRole("link", { name: "Workshop materials" }).getAttribute("href")).toBe("https://example.test/materials");
  expect(screen.queryByRole("link", { name: "Slack" })).toBeNull();
});

it("keeps the ticket and larger QR accessible after check-in", async () => {
  fixtures.badge = "checked_in";
  render(await PortalEventPage({ params: Promise.resolve({ event: "sprint" }) }));
  expect(screen.getAllByText("Checked in").length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: /QR code/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View ticket" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("img", { name: /QR code/i })).toBeTruthy();
});
