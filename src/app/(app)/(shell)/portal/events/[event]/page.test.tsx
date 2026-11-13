// @vitest-environment jsdom
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  state: { kind: "reg-going", ticketId: "ticket-1" } as import("@/features/events/lib/event-states").EventState,
  sign: vi.fn(() => "signed-ticket-token"),
  fetchLinks: vi.fn(),
  termEndsAt: null as string | null,
  user: { id: "user-1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.test", membership_type_id: "tier", membership_expires_at: "2099-01-01T00:00:00Z" },
  event: { id: "event-1", slug: "sprint", name: "Design Sprint", status: "active", starts_at: "2099-01-01T18:00:00Z", ends_at: "2099-01-01T20:00:00Z", agenda_enabled: false, mentors_enabled: false, sponsors_enabled: false, description: "An event.", pricing_policy: "figma", regular_price: 20, member_price: 0 },
  ticket: { id: "ticket-1", event_id: "event-1", user_id: "user-1" },
}));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn() }, errorFields: vi.fn() }));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: async () => fixtures.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventBySlug: async () => fixtures.event }));
vi.mock("@/lib/supabase-helpers/event-agenda", () => ({ fetchEventAgenda: async () => [] }));
vi.mock("@/lib/supabase-helpers/event-people", () => ({ fetchEventMentors: async () => [], fetchEventSponsors: async () => [] }));
vi.mock("@/lib/supabase-helpers/event-links", () => ({ fetchEventLinks: fixtures.fetchLinks }));
vi.mock("@/lib/check-in-token", () => ({ createCheckInToken: fixtures.sign }));
vi.mock("@/features/events/lib/event-states", () => ({ loadEventStates: async () => ({ "event-1": fixtures.state }) }));
vi.mock("@/features/memberships/lib/term", () => ({ getMembershipTermEndsAt: async () => fixtures.termEndsAt }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/shared/FlowLink", () => ({ FlowLink: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/features/events/components/EventAgendaTable", () => ({ EventAgendaTable: () => null }));
vi.mock("@/features/events/components/EventPeopleCard", () => ({ EventPeopleCard: () => null }));

import PortalEventPage from "./page";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";

// Resolve the async server child before rendering its client controls in jsdom.
async function renderPage() {
  const page = await PortalEventPage({ params: Promise.resolve({ event: "sprint" }) });
  const children = await Promise.all(Children.toArray(page.props.children).map(async (child) =>
    isValidElement<Parameters<typeof RegistrationPanel>[0]>(child) && child.type === RegistrationPanel
      ? cloneElement(await RegistrationPanel(child.props), { key: child.key })
      : child
  ));
  return render(cloneElement(page, {}, children));
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.state = { kind: "reg-going", ticketId: fixtures.ticket.id };
  fixtures.fetchLinks.mockResolvedValue([]);
  fixtures.termEndsAt = null;
  fixtures.user.membership_expires_at = "2099-01-01T00:00:00Z";
  fixtures.event.pricing_policy = "figma";
});

it("shows a scannable ticket on the event page after registration, alongside Going", async () => {
  await renderPage();
  expect(fixtures.sign).toHaveBeenCalledWith("ticket-1");
  expect(screen.getAllByText("Going").length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: /QR code/i })).toBeTruthy();
  expect(screen.getByText("Registration")).toBeTruthy();
  expect(screen.getByText("1 ticket")).toBeTruthy();
  expect(screen.getByText("You’re going to Design Sprint")).toBeTruthy();
  expect(screen.getByText("Show your ticket at check-in.")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "View participant package" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View ticket" }));
  const dialog = await screen.findByRole("dialog", { name: "Your ticket" });
  expect(within(dialog).getByRole("img", { name: /QR code/i })).toBeTruthy();
});

it("does not render or sign an issued QR for an accepted applicant without a ticket", async () => {
  fixtures.state = { kind: "app-accepted", offerExpiresAt: null };
  await renderPage();
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
  await renderPage();
  expect(fixtures.fetchLinks).toHaveBeenCalledWith(expect.anything(), "event-1");
  expect(screen.getByRole("link", { name: "View participant package" }).getAttribute("href")).toBe("https://example.test/package");
  expect(screen.getByRole("link", { name: "Workshop materials" }).getAttribute("href")).toBe("https://example.test/materials");
  expect(screen.queryByRole("link", { name: "Slack" })).toBeNull();
});

it("keeps the ticket and larger QR accessible after check-in", async () => {
  fixtures.state = { kind: "reg-checked-in", ticketId: "ticket-1", checkedInAt: "2099-01-01T18:00:00Z" };
  await renderPage();
  expect(screen.getAllByText("Checked in").length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: /QR code/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View ticket" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("img", { name: /QR code/i })).toBeTruthy();
});

it.each([
  ["active membership", "2099-01-01T00:00:00Z", null, "figma", false],
  ["personal expiry", "2000-01-01T00:00:00Z", null, "figma", true],
  ["club term expiry", "2099-01-01T00:00:00Z", "2000-01-01T00:00:00Z", "figma", true],
  ["legacy pricing", "2000-01-01T00:00:00Z", null, "legacy", false],
] as const)("matches checkout pricing for %s", async (_label, expiry, termEndsAt, policy, pays) => {
  fixtures.state = { kind: "app-accepted", offerExpiresAt: null };
  fixtures.user.membership_expires_at = expiry;
  fixtures.termEndsAt = termEndsAt;
  fixtures.event.pricing_policy = policy;
  await renderPage();
  expect(Boolean(screen.queryByText("CA$20.00 for non-members"))).toBe(pays);
});
