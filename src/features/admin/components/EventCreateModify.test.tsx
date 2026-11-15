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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
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

function expectActionsDisabled(name: string, disabled: boolean) {
  const buttons = screen.getAllByRole("button", { name });
  expect(buttons).toHaveLength(2);
  buttons.forEach(button => expect(button).toHaveProperty("disabled", disabled));
}

it("disables unavailable actions on an untouched form and keeps Summary links available", () => {
  render(<EventCreateModify />);
  const name = screen.getByLabelText("Event name");
  expect(name.hasAttribute("aria-invalid")).toBe(false);
  expectActionsDisabled("Save draft", true);
  expectActionsDisabled("Publish", true);
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Publish" })[0], { key: "Enter" });
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Description" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Short overview"));
  fireEvent.change(name, { target: { value: "Design Sprint" } });
  expectActionsDisabled("Save draft", false);
  expectActionsDisabled("Publish", true);
});

it("enables publishing a complete unchanged draft and tracks edits restored to their original value", () => {
  render(<EventCreateModify initialDraft={completeDraft} />);
  expectActionsDisabled("Save draft", true);
  expectActionsDisabled("Publish", false);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "" } });
  expectActionsDisabled("Save draft", false);
  expectActionsDisabled("Publish", true);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "A day of design" } });
  expectActionsDisabled("Save draft", true);
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


it("uses Proud Hubbo at 200px after the first draft save and enables saved-draft deletion", async () => {
  const { saveAdminEventDraftAction } = await import("../actions");
  vi.mocked(saveAdminEventDraftAction).mockResolvedValueOnce({ id: "saved-id", eventId: "saved-id", revision: 1, eventRevision: 1, pageSlug: "saved-draft" });
  render(<EventCreateModify />);
  fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Saved draft" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Draft saved" });
  expect(within(dialog).getByTestId("hubbo").getAttribute("data-emotion")).toBe("proud");
  expect(within(dialog).getByTestId("hubbo").className).toContain("h-50");
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Draft saved" })).toBeNull());
  expect(screen.getByRole("button", { name: "Delete event" })).toBeTruthy();
  expectActionsDisabled("Save draft", true);
});

it("shows a taken Page URL inline, focuses it and clears the error when corrected", async () => {
  const { saveAdminEventDraftAction } = await import("../actions");
  vi.mocked(saveAdminEventDraftAction).mockResolvedValueOnce({ error: "This page URL is already in use." });
  render(<EventCreateModify initialDraft={completeDraft} />);
  expectActionsDisabled("Publish", false);
  const slug = screen.getByLabelText("Page URL");
  fireEvent.change(slug, { target: { value: "taken-url" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
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
  expectActionsDisabled("Save draft", false);
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
  const { container } = render(<EventCreateModify eventId={event.id} initialEvent={event} />);
  const settings = within(container.querySelector("#builder-settings")! as HTMLElement);
  const action = settings.queryByRole("button", { name: "Revert to draft" });
  expect(!!action).toBe(visible);
  if (visible) {
    expect(settings.getByText(/Save your changes and hide this event from members/)).toBeTruthy();
    expect(settings.getByRole("button", { name: "Delete event" }).parentElement?.className).toContain("border-t");
  }
});

it("keeps failed draft saves retryable from either button", async () => {
  const { saveAdminEventDraftAction } = await import("../actions");
  vi.mocked(saveAdminEventDraftAction).mockResolvedValue({ error: "Could not save draft" });
  render(<EventCreateModify initialDraft={completeDraft} />);
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "Changed overview" } });
  for (const index of [0, 1]) {
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[index]);
    await waitFor(() => expectActionsDisabled("Save draft", false));
  }
  expect(saveAdminEventDraftAction).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Short overview")).toHaveProperty("value", "Changed overview");
});
