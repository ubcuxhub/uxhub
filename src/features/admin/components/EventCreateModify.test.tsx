// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventCreateModify } from "./EventCreateModify";

vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: ({ emotion, className }: { emotion: string; className: string }) => <span data-testid="hubbo" data-emotion={emotion} className={className}>Hubbo</span> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/admin/actions", () => ({ recoverAdminEventDraftAction: vi.fn(async () => null), recoverAdminEventMutationAction: vi.fn(async () => null), savePastEventResourcesAction: vi.fn(), loadAdminEventDeletionInfoAction: vi.fn(async () => null), saveAdminEventDraftAction: vi.fn(), saveAdminEventAction: vi.fn(), deleteAdminEventAction: vi.fn(), discardUnusedEventImageAction: vi.fn(), searchAdminEventPeopleAction: vi.fn(async () => []) }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("reveals publish issues, focuses the first field, updates feedback after correction and follows Summary links", async () => {
  render(<EventCreateModify />);
  const name = screen.getByLabelText("Event name");
  expect(name.hasAttribute("aria-invalid")).toBe(false);
  expect(screen.getByRole("heading", { name: "Almost ready" })).toBeTruthy();
  const publish = screen.getAllByRole("button", { name: "Publish" })[0];
  fireEvent.keyDown(publish, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Publish now/ }));
  await waitFor(() => expect(name.getAttribute("aria-invalid")).toBe("true"));
  await waitFor(() => expect(document.activeElement).toBe(name));
  expect(screen.getByRole("heading", { name: "A few things to fix" })).toBeTruthy();
  fireEvent.change(name, { target: { value: "Design Sprint" } });
  await waitFor(() => expect(name.hasAttribute("aria-invalid")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /^Description · 2 to fix$/ }));
  expect(document.activeElement).toBe(screen.getByLabelText("Short overview"));
  fireEvent.change(screen.getByLabelText("Short overview"), { target: { value: "A day of design" } });
  expect(screen.getByRole("button", { name: /^Description · 1 to fix$/ })).toBeTruthy();
});

it("blocks uncommitted invalid date text rather than publishing its previous valid value", async () => {
  const { defaultFormState } = await import("./event-form/event-form-schema");
  const { emptyLocation } = await import("../lib/event-date-location");
  const { saveAdminEventAction, saveAdminEventDraftAction } = await import("../actions");
  render(<EventCreateModify initialDraft={{ id: "saved-draft", revision: 1, document: { version: 1, formState: { ...defaultFormState, name: "Design Sprint", short_description: "A day of design", description: "Overview", pricing_mode: "legacy", max_capacity: "10", date_location: { automatic: true, audience: "everyone", location: { ...emptyLocation(), building: "Nest", address: "6133 University Blvd" }, dates: [{ key: "one", session_id: null, date: "2099-08-01", start: "09:00", end: "17:00", label: "Opening", location: null }] } }, checkInEvents: [], applicationTemplate: [], mentors: [], sponsors: [] } }} />);
  const date = screen.getAllByLabelText("Date")[0];
  fireEvent.change(date, { target: { value: "not a date" } });
  fireEvent.blur(date);
  await waitFor(() => expect(date.getAttribute("aria-invalid")).toBe("true"));
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Publish" })[0], { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Publish now/ }));
  await waitFor(() => expect(document.activeElement).toBe(date));
  expect(saveAdminEventAction).not.toHaveBeenCalled();
  expect(saveAdminEventDraftAction).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Ready to publish" })).toBeNull();
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
});
