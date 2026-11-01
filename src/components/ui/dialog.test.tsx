// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";

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

function renderDialog(
  contentProps: Partial<React.ComponentProps<typeof DialogContent>> = {},
  body: React.ReactNode = <button type="button">First action</button>,
) {
  return render(
    <Dialog open>
      <DialogContent {...contentProps}>
        <DialogTitle>Edit thing</DialogTitle>
        <DialogDescription>Change the thing.</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>,
  );
}

describe("DialogContent initial focus", () => {
  it("focuses the dialog, not the close button, and renders no tooltip", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Edit thing" });
    expect(document.activeElement).toBe(dialog);
    expect(dialog.getAttribute("tabindex")).toBe("-1");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("still shows the close button's tooltip once it is focused", async () => {
    renderDialog();
    await act(async () => {
      screen.getByRole("button", { name: "Close" }).focus();
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("reaches the first control on Tab", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    // The focus trap leaves Tab alone while focus is on the container, so the
    // browser moves to the next tabbable element in the content.
    expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(true);
    expect(nextTabbable(dialog, dialog)).toBe(
      screen.getByRole("button", { name: "First action" }),
    );
  });

  it("keeps focus on an autoFocus input", () => {
    renderDialog({}, <input aria-label="Name" autoFocus />);
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("focuses an element marked data-autofocus", () => {
    renderDialog(
      {},
      <>
        <button type="button">First action</button>
        <input aria-label="Confirm" data-autofocus="" />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Confirm"));
  });

  it("runs a caller's onOpenAutoFocus first and respects preventDefault", () => {
    const onOpenAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      screen.getByRole("button", { name: "First action" }).focus();
    });
    renderDialog({ onOpenAutoFocus });
    expect(onOpenAutoFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First action" }),
    );
  });

  it("still focuses the dialog when the caller's handler does not prevent default", () => {
    const onOpenAutoFocus = vi.fn();
    renderDialog({ onOpenAutoFocus });
    expect(onOpenAutoFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });
});
