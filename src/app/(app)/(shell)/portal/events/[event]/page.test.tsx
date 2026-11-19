// @vitest-environment jsdom
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  state: { kind: "reg-going", ticketId: "ticket-1" } as import("@/features/events/lib/event-states").EventState,
  fetchTicket: vi.fn(),
  fetchLinks: vi.fn(),
  agenda: [] as import("@/lib/supabase-helpers/event-agenda").EventAgendaDay[],
  agendaProps: vi.fn(),
  termEndsAt: null as string | null,
  user: { id: "user-1", first_name: "Ada", last_name: "Lovelace", email: "ada@example.test", membership_type_id: "tier", membership_expires_at: "2099-01-01T00:00:00Z" },
  event: { id: "event-1", slug: "sprint", name: "Design Sprint", status: "active", starts_at: "2099-01-01T18:00:00Z", ends_at: "2099-01-01T20:00:00Z", agenda_enabled: false, mentors_enabled: false, sponsors_enabled: false, description: "An event.", pricing_policy: "figma", regular_price: 20, member_price: 0 },
  ticket: { id: "ticket-1", event_id: "event-1", user_id: "user-1", qr_token: "ticket-qr-token" },
}));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn() }, errorFields: vi.fn() }));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: async () => fixtures.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventBySlug: async () => fixtures.event }));
vi.mock("@/lib/supabase-helpers/event-agenda", () => ({ fetchEventParticipantContent: async () => ({ location: null, agenda: fixtures.agenda }) }));
vi.mock("@/lib/supabase-helpers/event-people", () => ({ fetchEventPeopleSections: async () => [], fetchEventSponsors: async () => [] }));
vi.mock("@/lib/supabase-helpers/event-links", () => ({ fetchEventLinks: fixtures.fetchLinks }));
vi.mock("@/lib/supabase-helpers/event-tickets", () => ({ fetchUserEventTicket: fixtures.fetchTicket }));
vi.mock("@/features/events/lib/event-states", () => ({ loadEventStates: async () => ({ "event-1": fixtures.state }) }));
vi.mock("@/features/memberships/lib/term", () => ({ getMembershipTermEndsAt: async () => fixtures.termEndsAt }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/shared/FlowLink", () => ({ FlowLink: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/features/events/components/EventAgendaTable", () => ({ EventAgendaTable: (props: unknown) => { fixtures.agendaProps(props); return null; } }));
vi.mock("@/features/events/components/EventPeopleCard", () => ({ EventPeopleCard: () => null }));
vi.mock("@/features/events/components/teams/TeamCard", () => ({ TeamCard: () => null, TeamInviteNotice: () => null }));
vi.mock("@/features/events/lib/team-card-data", () => ({ loadTeamCard: async () => null }));

import PortalEventPage from "./page";
import { RegistrationPanel } from "@/features/events/components/RegistrationPanel";

// Resolve the async server child before rendering its client controls in
// jsdom. It can sit inside a layout wrapper (the Registration and Your team
// row), so search the whole tree, not just the page's direct children.
async function resolveRegistrationPanel(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (node.type === RegistrationPanel) {
    const props = node.props as unknown as Parameters<typeof RegistrationPanel>[0];
    return cloneElement(await RegistrationPanel(props), { key: node.key });
  }
  if (node.props.children === undefined) return node;
  const children = await Promise.all(Children.toArray(node.props.children).map(resolveRegistrationPanel));
  return cloneElement(node, {}, children);
}

async function renderPage() {
  const page = await PortalEventPage({ params: Promise.resolve({ event: "sprint" }), searchParams: Promise.resolve({}) });
  return render(await resolveRegistrationPanel(page));
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.state = { kind: "reg-going", ticketId: fixtures.ticket.id };
  fixtures.fetchLinks.mockResolvedValue([]);
  fixtures.agenda = [];
  fixtures.fetchTicket.mockResolvedValue(fixtures.ticket);
  fixtures.termEndsAt = null;
  fixtures.user.membership_expires_at = "2099-01-01T00:00:00Z";
  fixtures.event.pricing_policy = "figma";
  fixtures.event.status = "active";
  fixtures.event.regular_price = 20;
});

it("shows a scannable ticket on the event page after registration, alongside Going", async () => {
  await renderPage();
  expect(fixtures.fetchTicket).toHaveBeenCalledWith(expect.anything(), "event-1", "user-1");
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

it("does not render or fetch an issued QR for an accepted applicant without a ticket", async () => {
  fixtures.state = { kind: "app-accepted", offerExpiresAt: null };
  await renderPage();
  expect(screen.queryByRole("img", { name: /QR code/i })).toBeNull();
  expect(screen.queryByRole("button", { name: "View ticket" })).toBeNull();
  expect(fixtures.fetchTicket).not.toHaveBeenCalled();
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

const slackLink = { id: "slack", type: "slack_workspace", label: null, url: "https://example.test/slack" };

it.each([
  ["going", { kind: "reg-going", ticketId: "ticket-1" }],
  ["checked in", { kind: "reg-checked-in", ticketId: "ticket-1", checkedInAt: "2099-01-01T18:00:00Z" }],
] as const)("shows Open Slack to a student who is %s, opening the workspace in a new tab", async (_label, state) => {
  fixtures.state = state;
  fixtures.fetchLinks.mockResolvedValue([slackLink]);
  await renderPage();
  const link = screen.getByRole("link", { name: /^Open Slack/ });
  expect(link.getAttribute("href")).toBe("https://example.test/slack");
  expect(link.getAttribute("target")).toBe("_blank");
});

it("hides Open Slack when the event has no Slack link", async () => {
  fixtures.fetchLinks.mockResolvedValue([
    { id: "package", type: "participant_package", label: null, url: "https://example.test/package" },
  ]);
  await renderPage();
  expect(screen.queryByRole("link", { name: /^Open Slack/ })).toBeNull();
});

it.each([
  ["registration open", { kind: "reg-open", closesAt: null }],
  ["accepted without a ticket", { kind: "app-accepted", offerExpiresAt: null }],
  ["past", { kind: "reg-past-attended", ticketId: "ticket-1" }],
  ["canceled", { kind: "canceled", note: null, ticketId: "ticket-1" }],
] as const)("hides Open Slack from a student who isn't going (%s)", async (_label, state) => {
  fixtures.state = state;
  fixtures.fetchLinks.mockResolvedValue([slackLink]);
  await renderPage();
  expect(screen.queryByRole("link", { name: /^Open Slack/ })).toBeNull();
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

// RLS returns a draft to admins and managers only, so the banner is theirs alone.
it.each([
  ["draft", true],
  ["active", false],
] as const)("shows the staff-only draft banner on a %s event: %s", async (status, shown) => {
  fixtures.event.status = status;
  fixtures.state = { kind: "reg-open", closesAt: null };
  await renderPage();
  expect(
    Boolean(screen.queryByText(/This is a draft event\. Draft events are only visible to admins and managers\./))
  ).toBe(shown);
});

// Staff test registration on a draft is free events only (docs/event-states.md).
it.each([
  ["free", 0, true],
  ["paid", 20, false],
] as const)("offers staff test registration on a %s draft: %s", async (_label, price, offered) => {
  fixtures.event.status = "draft";
  fixtures.event.regular_price = price;
  fixtures.state = { kind: "reg-open", closesAt: null };
  await renderPage();
  expect(Boolean(screen.queryByText("Test registration (staff only)"))).toBe(offered);
  expect(Boolean(screen.queryByText(/This creates a real registration/))).toBe(offered);
  const disabled = screen.queryByRole("button", { name: "Paid drafts can’t be test-registered" });
  expect(Boolean(disabled)).toBe(!offered);
  if (disabled) expect((disabled as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Registration")).toBeNull();
});

it("offers no test registration on a published event", async () => {
  fixtures.state = { kind: "reg-open", closesAt: null };
  await renderPage();
  expect(screen.queryByText("Test registration (staff only)")).toBeNull();
});

it("passes only links attached to an agenda item to the agenda, keyed by item", async () => {
  fixtures.state = { kind: "reg-open", closesAt: null };
  fixtures.agenda = [{ id: "day-1", date: "2099-01-01", title: "Kickoff", location_overridden: false, location: null, items: [
    { id: "item-1", title: "Final presentations", starts_at: null, ends_at: null, description: null, check_in: false, location_overridden: false, location: null },
  ] }];
  fixtures.fetchLinks.mockResolvedValue([
    { id: "slides", type: "other", label: "Slides", url: "https://example.test/slides", agenda_item_id: "item-1" },
    { id: "slack", type: "slack_workspace", label: null, url: "https://example.test/slack", agenda_item_id: null },
  ]);
  await renderPage();
  expect(fixtures.fetchLinks).toHaveBeenCalledWith(expect.anything(), "event-1");
  expect(fixtures.agendaProps).toHaveBeenCalledWith(expect.objectContaining({
    itemLinks: { "item-1": "https://example.test/slides" },
    today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }));
});

it("doesn't fetch links for agenda items when the event has no agenda", async () => {
  fixtures.state = { kind: "reg-open", closesAt: null };
  await renderPage();
  expect(fixtures.fetchLinks).not.toHaveBeenCalled();
  expect(fixtures.agendaProps).toHaveBeenCalledWith(expect.objectContaining({ itemLinks: {} }));
});
