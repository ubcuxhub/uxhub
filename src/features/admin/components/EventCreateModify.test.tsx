// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultFormState } from "./event-form/event-form-schema";
import { emptyLocation } from "../lib/event-date-location";
import { plainDescription } from "@/lib/event-description";
import type { EventRow } from "@/lib/supabase/models";
import { EventCreateModify } from "./EventCreateModify";
import { toast } from "@/components/ui/toast";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: ({ emotion, className }: { emotion: string; className: string }) => <span data-testid="hubbo" data-emotion={emotion} className={className}>Hubbo</span> }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/admin/event-overview-actions", () => ({ loadEventLifecycleCountsAction: vi.fn(async () => ({ registered: 0, memberApplications: 2, paidTickets: 0 })) }));
vi.mock("@/features/admin/actions", () => ({ recoverAdminEventDraftAction: vi.fn(async () => null), recoverAdminEventMutationAction: vi.fn(async () => null), savePastEventResourcesAction: vi.fn(), loadAdminEventDeletionInfoAction: vi.fn(async () => null), saveAdminEventDraftAction: vi.fn(), saveAdminEventAction: vi.fn(), deleteAdminEventAction: vi.fn(), discardUnusedEventImageAction: vi.fn(), searchAdminEventPeopleAction: vi.fn(async () => []) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const completeDraft = {
  id: "saved-draft", revision: 1,
  document: {
    version: 1 as const,
    formState: { ...defaultFormState, name: "Design Sprint", short_description: "A day of design", description: "Overview", description_rich: plainDescription("Overview"), pricing_mode: "legacy" as const, max_capacity: "10", date_location: { automatic: true, audience: "everyone" as const, location: { ...emptyLocation(), building: "Nest", address: "6133 University Blvd" }, dates: [{ key: "one", session_id: null, date: "2099-08-01", start: "09:00", end: "17:00", label: "Opening", location: null }] } },
    checkInEvents: [], applicationTemplate: [], mentors: [], sponsors: [],
  },
};

/** Publish, Save changes and Update sit in the header and the Publish footer; Save only in the header. */
function expectActionsDisabled(name: string, disabled: boolean) {
  const buttons = screen.getAllByRole("button", { name });
  expect(buttons).toHaveLength(name === "Save" ? 1 : 2);
  buttons.forEach(button => expect(button).toHaveProperty("disabled", disabled));
}

const publishedEvent = { id: "event-1", name: "Published event", slug: "published-event", status: "active", publish_at: null, ends_at: "2099-08-01T19:00:00Z", starts_at: "2099-08-01T18:00:00Z", short_description: "Overview", description: "Description", regular_price: 0, member_price: 0, max_capacity: 10, canceled_at: null } as EventRow;

function openMoreActions() {
  fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
  return screen.getByRole("menu");
}

it("ends at Links and resources, with no Summary or Other settings section", () => {
  const { container } = render(<EventCreateModify />);
  const sections = [...container.querySelectorAll("[data-builder-section]")].map(section => section.id);
  expect(sections.at(-1)).toBe("builder-resources");
  expect(sections).toHaveLength(8);
  expect(container.querySelector("#builder-summary, #builder-settings")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Summary" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Other settings" })).toBeNull();
  const navigator = screen.getByRole("button", { name: /section 1 of 8/ });
  fireEvent.keyDown(navigator, { key: "Enter" });
  const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
  expect(items).toHaveLength(8);
  expect(items.at(-1)?.textContent).toMatch(/Links and resources/);
  // The footer is unnumbered and stays out of the navigator.
  const footer = container.querySelector<HTMLElement>("#builder-publish")!;
  expect(footer.hasAttribute("data-builder-section")).toBe(false);
  expect(within(footer).queryByText(/^Section/)).toBeNull();
  expect(container.querySelector("#builder-resources")!.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("keeps applications in their own section behind a switch", () => {
  const { container } = render(<EventCreateModify />);
  const registration = within(container.querySelector<HTMLElement>("#builder-registration")!);
  const applications = within(container.querySelector<HTMLElement>("#builder-applications")!);
  expect(registration.getByText("Registration window")).toBeTruthy();
  expect(applications.queryByText("Application window")).toBeNull();
  const toggle = applications.getByRole("switch", { name: "Members apply before they register" });
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(registration.queryByText("Registration window")).toBeNull();
  expect(applications.getByText("Application window")).toBeTruthy();
  expect(applications.getByLabelText("Applications open")).toBeTruthy();
  expect(applications.getAllByText("Application questions").length).toBeGreaterThan(0);
  expect(applications.getByText("Application timing")).toBeTruthy();
});

it("locks the applications switch once registrations or payments exist", () => {
  const { container } = render(<EventCreateModify registrationInfo={{ locked: true, seats: 1 }} />);
  const applications = within(container.querySelector<HTMLElement>("#builder-applications")!);
  expect(applications.getByRole("switch", { name: "Members apply before they register" }).hasAttribute("disabled")).toBe(true);
  expect(applications.getByText(/Locked because registrations or payments exist/)).toBeTruthy();
});

it("lists what's left in the Publish footer and jumps to each section", async () => {
  const { container } = render(<EventCreateModify />);
  const footer = within(container.querySelector<HTMLElement>("#builder-publish")!);
  expect(footer.getByRole("heading", { name: "Almost ready" })).toBeTruthy();
  expect(footer.getByRole("heading", { name: "What’s left" })).toBeTruthy();
  fireEvent.click(footer.getByRole("button", { name: "Basics" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Event name"));
  fireEvent.click(footer.getByRole("button", { name: "Description" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Short overview"));
  expect(footer.getByRole("button", { name: "Publish" })).toHaveProperty("disabled", true);
});

it("shows the ready state without a list once nothing is left", () => {
  const { container } = render(<EventCreateModify initialDraft={completeDraft} />);
  const footer = within(container.querySelector<HTMLElement>("#builder-publish")!);
  expect(footer.getByRole("heading", { name: "Ready to publish" })).toBeTruthy();
  expect(footer.queryByRole("heading", { name: "What’s left" })).toBeNull();
  expect(footer.getByRole("button", { name: "Publish" })).toHaveProperty("disabled", false);
});

it("shows a publish-date issue in the Publish footer and blocks publishing", () => {
  const draft = { ...completeDraft, document: { ...completeDraft.document, formState: { ...completeDraft.document.formState, publish_at: "2099-07-01T10:00", registration_closes_at: "2099-07-01T10:00" } } };
  const { container } = render(<EventCreateModify initialDraft={draft} />);
  const footer = within(container.querySelector<HTMLElement>("#builder-publish")!);
  expect(footer.getByText("Publish time must be before registration closes.")).toBeTruthy();
  expect(footer.getByRole("heading", { name: "Almost ready" })).toBeTruthy();
  expectActionsDisabled("Publish", true);
});

it("has one Save, in the header, and Update in the header and footer of a published event", () => {
  const { container, unmount } = render(<EventCreateModify initialDraft={completeDraft} />);
  const save = screen.getByRole("button", { name: "Save" });
  expect(container.querySelector("#event-builder-header")!.contains(save)).toBe(true);
  unmount();
  const published = render(<EventCreateModify eventId={publishedEvent.id} initialEvent={publishedEvent} />);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Update" })).toHaveLength(2);
  expect(within(published.container.querySelector<HTMLElement>("#builder-publish")!).getByRole("heading", { name: "Published" })).toBeTruthy();
});

it("opens the delete modal from the More actions menu", async () => {
  const { loadAdminEventDeletionInfoAction } = await import("../actions");
  const event = { ...publishedEvent, status: "draft" } as EventRow;
  render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  const menu = openMoreActions();
  expect(within(menu).queryByRole("menuitem", { name: "Revert to draft" })).toBeNull();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete event" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(loadAdminEventDeletionInfoAction).toHaveBeenCalledWith("event-1");
});

it("hides More actions on a new event that has nothing to delete", () => {
  render(<EventCreateModify />);
  expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
});

it("disables unavailable actions on an untouched form and keeps the footer's links available", () => {
  render(<EventCreateModify />);
  const name = screen.getByLabelText("Event name");
  expect(name.hasAttribute("aria-invalid")).toBe(false);
  expectActionsDisabled("Save", true);
  expectActionsDisabled("Publish", true);
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Publish" })[0], { key: "Enter" });
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Description" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Short overview"));
  fireEvent.change(name, { target: { value: "Design Sprint" } });
  expectActionsDisabled("Save", false);
  expectActionsDisabled("Publish", true);
});

it("enables publishing a complete unchanged draft and tracks edits restored to their original value", () => {
  render(<EventCreateModify initialDraft={completeDraft} />);
  expectActionsDisabled("Save", true);
  expectActionsDisabled("Publish", false);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "" } });
  expectActionsDisabled("Save", false);
  expectActionsDisabled("Publish", true);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "A day of design" } });
  expectActionsDisabled("Save", true);
  expectActionsDisabled("Publish", false);
});

it("blocks both Publish triggers for uncommitted invalid date text and enables them when corrected", async () => {
  const { saveAdminEventAction, saveAdminEventDraftAction } = await import("../actions");
  render(<EventCreateModify initialDraft={completeDraft} />);
  expectActionsDisabled("Publish", false);
  const date = screen.getAllByLabelText("Date")[0];
  fireEvent.change(date, { target: { value: "not a date" } });
  fireEvent.blur(date);
  await waitFor(() => expectActionsDisabled("Publish", true));
  expect(date.getAttribute("aria-invalid")).toBe("true");
  expect(saveAdminEventAction).not.toHaveBeenCalled();
  expect(saveAdminEventDraftAction).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Ready to publish" })).toBeNull();
  fireEvent.change(date, { target: { value: "Aug 1, 2099" } });
  fireEvent.blur(date);
  await waitFor(() => expectActionsDisabled("Publish", false));
});

it("disables the entire scheduled menu for incomplete edits and restores it after Discard changes", async () => {
  const event = { id: "event-1", name: "Design Sprint", slug: "design-sprint", status: "draft", publish_at: "2099-07-01T18:00:00Z", ends_at: "2099-08-02T00:00:00Z", starts_at: "2099-08-01T16:00:00Z", short_description: "A day of design", description: "Overview", max_capacity: 10 } as EventRow;
  render(<EventCreateModify eventId={event.id} initialEvent={event} initialDraft={completeDraft} />);
  expectActionsDisabled("Publish", false);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "" } });
  expectActionsDisabled("Publish", true);
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expectActionsDisabled("Publish", false));
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Publish" })[1], { key: "Enter" });
  expect(await screen.findByRole("menuitem", { name: /Cancel schedule/ })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: /Change scheduled publish time/ })).toBeTruthy();
});

it("shows optional section badges and replaces them when the section is completed", () => {
  const { container } = render(<EventCreateModify />);
  const teams = within(container.querySelector("#builder-teams")! as HTMLElement);
  const basics = within(container.querySelector("#builder-basics")! as HTMLElement);
  expect(teams.getByText("Optional")).toBeTruthy();
  expect(basics.queryByText("Complete")).toBeNull();
  fireEvent.click(teams.getByRole("radio", { name: "Yes" }));
  expect(teams.getByText("Complete")).toBeTruthy();
  fireEvent.click(teams.getByRole("radio", { name: "No" }));
  expect(teams.getByText("Optional")).toBeTruthy();
  expect(teams.queryByText("Complete")).toBeNull();
});


it("refuses to save an incomplete new event and points at what is missing", async () => {
  const { saveAdminEventAction, saveAdminEventDraftAction } = await import("../actions");
  render(<EventCreateModify />);
  fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Half finished" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
  await waitFor(() => expect(screen.getAllByText(/to fix/).length).toBeGreaterThan(0));
  expect(saveAdminEventDraftAction).not.toHaveBeenCalled();
  expect(saveAdminEventAction).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "Draft saved" })).toBeNull();
  expect(screen.getByLabelText("Event name")).toHaveProperty("value", "Half finished");
});

it("uses Proud Hubbo at 200px after a draft save applies the edits and enables saved-draft deletion", async () => {
  const { saveAdminEventAction, saveAdminEventDraftAction } = await import("../actions");
  vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ id: "saved-id", revision: 1, pageSlug: "design-sprint", checkInSessionIds: ["session-1"], questionIds: [] });
  render(<EventCreateModify initialDraft={completeDraft} />);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "Changed overview" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Draft saved" });
  expect(within(dialog).getByTestId("hubbo").getAttribute("data-emotion")).toBe("proud");
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Draft saved" })).toBeNull());
  expect(within(openMoreActions()).getByRole("menuitem", { name: "Delete event" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expectActionsDisabled("Save", true);
  expect(saveAdminEventDraftAction).not.toHaveBeenCalled();
  expect(saveAdminEventAction).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ short_description: "Changed overview", status: "draft", publish_at: null }) }));
});

it("shows a taken Page URL inline, focuses it and clears the error when corrected", async () => {
  const { saveAdminEventAction } = await import("../actions");
  vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ error: "This page URL is already in use." });
  render(<EventCreateModify initialDraft={completeDraft} />);
  expectActionsDisabled("Publish", false);
  const slug = screen.getByLabelText("Page URL");
  fireEvent.change(slug, { target: { value: "taken-url" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
  await waitFor(() => expect(slug.getAttribute("aria-invalid")).toBe("true"));
  await waitFor(() => expect(document.activeElement).toBe(slug));
  const field = slug.closest('[data-slot="field"]')! as HTMLElement;
  const message = within(field).getByRole("alert");
  expect(message.textContent).toBe("This page URL is already in use.");
  expect(slug.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
  expect(slug.className).toContain("aria-invalid:border-destructive");
  expect(toast.error).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(slug).toHaveProperty("value", "taken-url");
  expectActionsDisabled("Save", false);
  expectActionsDisabled("Publish", true);
  fireEvent.change(slug, { target: { value: "available-url" } });
  await waitFor(() => expect(slug.hasAttribute("aria-invalid")).toBe(false));
  expect(within(field).queryByRole("alert")).toBeNull();
  await waitFor(() => expectActionsDisabled("Publish", false));
});

it.each([
  ["active", null, "2099-08-01T19:00:00Z", true],
  ["draft", null, "2099-08-01T19:00:00Z", false],
  ["draft", "2099-07-01T18:00:00Z", "2099-08-01T19:00:00Z", false],
  ["active", null, "2020-08-01T19:00:00Z", false],
] as const)("offers Revert to draft only for a current published event (%s, %s, %s)", async (status, publish_at, ends_at, visible) => {
  const event = { id: "event-1", name: "Published event", slug: "published-event", status, publish_at, ends_at, starts_at: "2099-08-01T18:00:00Z", short_description: "Overview", description: "Description", regular_price: 0, member_price: 0, max_capacity: 10 } as import("@/lib/supabase/models").EventRow;
  render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  const menu = openMoreActions();
  expect(!!within(menu).queryByRole("menuitem", { name: "Revert to draft" })).toBe(visible);
  expect(within(menu).getByRole("menuitem", { name: "Delete event" })).toBeTruthy();
});

it("confirms Revert to draft before saving, naming the applications that lose access", async () => {
  const { saveAdminEventAction } = await import("../actions");
  vi.mocked(saveAdminEventAction).mockClear();
  const event = { id: "event-1", name: "Published event", slug: "published-event", status: "active", publish_at: null, ends_at: "2099-08-01T19:00:00Z", starts_at: "2099-08-01T18:00:00Z", short_description: "Overview", description: "Description", regular_price: 0, member_price: 0, max_capacity: 10, canceled_at: null } as import("@/lib/supabase/models").EventRow;
  render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  fireEvent.click(within(openMoreActions()).getByRole("menuitem", { name: "Revert to draft" }));
  expect(await screen.findByText(/2 member applications \(submitted, waitlisted or draft\) will lose access/)).toBeTruthy();
  expect(saveAdminEventAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep published" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions" })));
});

it("locks a canceled event like an ended one, without Revert", () => {
  const event = { id: "event-1", name: "Canceled event", slug: "canceled-event", status: "active", publish_at: null, ends_at: "2099-08-01T19:00:00Z", starts_at: "2099-08-01T18:00:00Z", short_description: "Overview", description: "Description", regular_price: 0, member_price: 0, max_capacity: 10, canceled_at: "2099-07-01T18:00:00Z" } as import("@/lib/supabase/models").EventRow;
  const { container } = render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  expect(screen.getByText("This event is canceled")).toBeTruthy();
  expect(within(container.querySelector<HTMLElement>("#builder-publish")!).getByRole("heading", { name: "Event canceled" })).toBeTruthy();
  const menu = openMoreActions();
  expect(within(menu).queryByRole("menuitem", { name: "Revert to draft" })).toBeNull();
  expect(within(menu).getByRole("menuitem", { name: "Delete event" })).toBeTruthy();
});

it("keeps failed draft saves retryable", async () => {
  const { saveAdminEventAction } = await import("../actions");
  vi.mocked(saveAdminEventAction).mockResolvedValue({ error: "Could not save draft" });
  render(<EventCreateModify initialDraft={completeDraft} />);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "Changed overview" } });
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expectActionsDisabled("Save", false));
  }
  expect(saveAdminEventAction).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Short overview")).toHaveProperty("value", "Changed overview");
});

it("starts the header with Back to event, to the event manager's Overview", () => {
  const event = { ...publishedEvent, status: "draft" } as EventRow;
  const { container } = render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  const back = screen.getByRole("link", { name: "Back to event" });
  expect(back.getAttribute("href")).toBe("/admin/events/event-1/overview");
  const header = container.querySelector<HTMLElement>("#event-builder-header")!;
  expect(header.firstElementChild).toBe(back);
  expect(screen.queryByRole("link", { name: "Back to Manage Events" })).toBeNull();
  // The drawer's top bar belongs to the manager now, not the builder.
  expect(screen.queryByRole("link", { name: "Collapse to drawer" })).toBeNull();
});

it("goes back to Manage Events from a new event, which has no manager yet", () => {
  render(<EventCreateModify />);
  expect(screen.getByRole("link", { name: "Back to Manage Events" }).getAttribute("href")).toBe("/admin/events");
  expect(screen.queryByRole("link", { name: "Back to event" })).toBeNull();
});

/**
 * Renames a draft event and clicks Back to event, which the unsaved-changes
 * guard intercepts. Every builder step re-renders the whole form, so queries
 * stay inside the header and the dialog, and each outcome gets its own test:
 * one test doing both, with page-wide role queries, ran past Vitest's 5s
 * budget on a busy machine.
 */
async function clickBackWithUnsavedChanges() {
  const event = { ...publishedEvent, status: "draft" } as EventRow;
  const { container } = render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  fireEvent.change(within(container.querySelector<HTMLElement>("#builder-basics")!).getByLabelText("Event name"), { target: { value: "Renamed event" } });
  const header = within(container.querySelector<HTMLElement>("#event-builder-header")!);
  expect(header.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
  const back = header.getByRole("link", { name: "Back to event" });
  expect(fireEvent.click(back)).toBe(false);
  const dialog = await screen.findByRole("dialog", { name: "Leave without saving?" });
  expect(router.push).not.toHaveBeenCalled();
  return { back, dialog };
}

it("asks before Back to event leaves unsaved changes, and asks again after Keep editing", async () => {
  const { back, dialog } = await clickBackWithUnsavedChanges();
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(router.push).not.toHaveBeenCalled();

  expect(fireEvent.click(back)).toBe(false);
  expect(await screen.findByRole("dialog", { name: "Leave without saving?" })).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});

it("leaves for the event's Overview on Discard and leave", async () => {
  const { dialog } = await clickBackWithUnsavedChanges();
  fireEvent.click(within(dialog).getByRole("button", { name: "Discard and leave" }));
  expect(router.push).toHaveBeenCalledWith("/admin/events/event-1/overview");
});
