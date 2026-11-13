// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventPublicationSuccess, EventPublishMenu } from "./EventPublicationControls";
import type { useEventForm } from "../../hooks/use-event-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each(["active", "draft"])("uses saved data and an accessible saved-event link for %s success", async status => {
  const close = vi.fn();
  const form = { publicationSuccess: { id: "saved-event", name: "Saved event name", status, publish_at: status === "draft" ? "2099-08-01T17:00:00Z" : null, registration_opens_at: "2099-08-02T17:00:00Z", registration_closes_at: null, completed_at: Date.parse("2024-01-01T00:00:00Z") }, setPublicationSuccess: close } as unknown as ReturnType<typeof useEventForm>;
  const content = (current: typeof form) => <><div id="event-builder-header"><button type="button">Update event</button></div><EventPublicationSuccess form={current} /></>;
  const { rerender } = render(content(form));
  expect(screen.getByRole("dialog", { name: status === "draft" ? "Event scheduled" : "Event published" })).toBeTruthy();
  expect(screen.getByText(/Saved event name/).textContent).toContain(status === "draft" ? "goes live" : "Registration opens");
  expect(screen.getByRole("link", { name: "View event page" }).getAttribute("href")).toBe("/admin/events/saved-event");
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(close).toHaveBeenCalledWith(null);
  rerender(content({ ...form, publicationSuccess: null }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Update event" })));
});


it.each([
  { method: "keyboard", publishAt: null },
  { method: "pointer", publishAt: null },
  { method: "keyboard", publishAt: "2099-08-01T16:00:00Z" },
  { method: "pointer", publishAt: "2099-08-01T16:00:00Z" },
])("keeps scheduling open with $method (saved time: $publishAt) and while editing it", async ({ method, publishAt }) => {
  // Browsers keep the closing menu mounted for its CSS exit animation.
  // jsdom has no animations or live computed styles, so model that lifecycle.
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(element => {
    const styles = getStyle(element);
    if (element.getAttribute("data-slot") === "dropdown-menu-content") {
      Object.defineProperty(styles, "animationName", { get: () => element.getAttribute("data-state") === "open" ? "menu-enter" : "menu-exit" });
    }
    return styles;
  });
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? "mouse"; }
  });
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  const handlePublication = vi.fn();
  const form = { formState: { publish_at: "2099-08-01T09:00", registration_closes_at: "" }, publication: { status: "draft", publish_at: publishAt }, isSubmitting: false, handlePublication } as unknown as ReturnType<typeof useEventForm>;
  render(<EventPublishMenu form={form} />);
  if (method === "keyboard") fireEvent.keyDown(screen.getByRole("button", { name: "Publish" }), { key: "Enter" });
  else fireEvent.pointerDown(screen.getByRole("button", { name: "Publish" }), { button: 0, ctrlKey: false });
  const scheduleItem = await screen.findByRole("menuitem", { name: publishAt ? /Change scheduled publish time/ : /^Schedule…/ });
  const menu = screen.getByRole("menu");
  if (method === "keyboard") {
    scheduleItem.focus();
    fireEvent.keyDown(scheduleItem, { key: "Enter" });
  } else {
    fireEvent.pointerMove(scheduleItem, { pointerType: "mouse" });
    fireEvent.pointerDown(scheduleItem, { button: 0 });
    fireEvent.pointerUp(scheduleItem, { button: 0 });
    fireEvent.click(scheduleItem);
  }
  const picker = await screen.findByRole("dialog", { name: "Schedule publishing" });
  // A small mouse movement over the fading item must not reclaim focus.
  if (method === "pointer") fireEvent.pointerMove(scheduleItem, { pointerType: "mouse" });
  fireEvent.animationEnd(menu, { animationName: "menu-exit" });
  // Allow both Radix focus scopes to finish their open/close lifecycle.
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(picker.isConnected).toBe(true);
  expect(menu.isConnected).toBe(false);
  const date = screen.getByLabelText("Date");
  fireEvent.pointerDown(date, { pointerType: "mouse", button: 0 });
  fireEvent.focus(date);
  fireEvent.click(date);
  fireEvent.change(date, { target: { value: "Aug 2, 2099" } });
  fireEvent.blur(date);
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(screen.getByRole("dialog", { name: "Schedule publishing" })).toBe(picker);
  expect(handlePublication).not.toHaveBeenCalled();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
  await screen.findByRole("grid");
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(screen.getByRole("dialog", { name: "Schedule publishing" })).toBe(picker);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Schedule publishing" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Publish" })));
  fireEvent.keyDown(screen.getByRole("button", { name: "Publish" }), { key: "Enter" });
  expect(await screen.findByRole("menuitem", { name: publishAt ? /Change scheduled publish time/ : /^Schedule…/i })).toBeTruthy();
});
