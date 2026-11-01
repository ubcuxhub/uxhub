// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

afterEach(cleanup);

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** What native Tab does: the next tabbable element after `from` in DOM order. */
function nextTabbable(root: HTMLElement, from: HTMLElement) {
  const items = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE));
  return items.find(
    (item) =>
      from.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function renderSheet(
  contentProps: Partial<React.ComponentProps<typeof SheetContent>> = {},
  body: React.ReactNode = <button type="button">First action</button>,
) {
  return render(
    <Sheet open>
      <SheetContent {...contentProps}>
        <SheetTitle>Event details</SheetTitle>
        <SheetDescription>View the event.</SheetDescription>
        {body}
      </SheetContent>
    </Sheet>,
  );
}

describe("SheetContent initial focus", () => {
  it("focuses the sheet, not the close button, and renders no tooltip", () => {
    renderSheet();
    const sheet = screen.getByRole("dialog", { name: "Event details" });
    expect(document.activeElement).toBe(sheet);
    expect(sheet.getAttribute("tabindex")).toBe("-1");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("still shows the close button's tooltip once it is focused", async () => {
    renderSheet();
    await act(async () => {
      screen.getByRole("button", { name: "Close" }).focus();
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("reaches the first control on Tab", () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    expect(fireEvent.keyDown(sheet, { key: "Tab" })).toBe(true);
    expect(nextTabbable(sheet, sheet)).toBe(
      screen.getByRole("button", { name: "First action" }),
    );
  });

  it("keeps focus on an autoFocus input", () => {
    renderSheet({}, <input aria-label="Name" autoFocus />);
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("runs a caller's onOpenAutoFocus first and respects preventDefault", () => {
    const onOpenAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      screen.getByRole("button", { name: "First action" }).focus();
    });
    renderSheet({ onOpenAutoFocus });
    expect(onOpenAutoFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First action" }),
    );
  });
});

describe("SheetContent Esc and [data-escape-clears] fields", () => {
  function renderControlled(
    value: string,
    onEscapeKeyDown?: (event: Event) => void,
  ) {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent onEscapeKeyDown={onEscapeKeyDown}>
          <SheetTitle>Event details</SheetTitle>
          <SheetDescription>View the event.</SheetDescription>
          <div data-escape-clears>
            <input aria-label="Search" defaultValue={value} />
          </div>
        </SheetContent>
      </Sheet>,
    );
    return onOpenChange;
  }

  it("stays open when Esc is pressed in a field that holds text", () => {
    const onOpenChange = renderControlled("ux");
    fireEvent.keyDown(screen.getByLabelText("Search"), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes when the field is empty", () => {
    const onOpenChange = renderControlled("");
    fireEvent.keyDown(screen.getByLabelText("Search"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("runs the caller's handler first and honours preventDefault", () => {
    const onEscapeKeyDown = vi.fn((event: Event) => event.preventDefault());
    const onOpenChange = renderControlled("", onEscapeKeyDown);
    fireEvent.keyDown(screen.getByLabelText("Search"), { key: "Escape" });
    expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
