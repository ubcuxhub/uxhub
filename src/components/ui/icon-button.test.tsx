// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { IconButton } from "./icon-button";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

afterEach(cleanup);

function ActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Actions for UXathon">...</IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Edit event</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("IconButton tooltip", () => {
  it("opens when keyboard focus reaches it", async () => {
    render(<IconButton label="Close">x</IconButton>);
    fireEvent.keyDown(document.body, { key: "Tab" });
    await act(async () => {
      screen.getByRole("button", { name: "Close" }).focus();
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("stays closed when focus returns after a mouse click in a menu", async () => {
    render(<ActionsMenu />);
    const trigger = screen.getByRole("button", { name: "Actions for UXathon" });

    // Open with the mouse, as a pointer user would.
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    await screen.findByRole("menu");
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Choose an item with the mouse. The menu closes and Radix focuses the
    // trigger again from a timeout.
    const item = screen.getByRole("menuitem", { name: "Edit event" });
    fireEvent.pointerDown(item);
    fireEvent.click(item);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens again on keyboard focus after a mouse click", async () => {
    render(<IconButton label="Close">x</IconButton>);
    const button = screen.getByRole("button", { name: "Close" });
    fireEvent.pointerDown(document.body);
    await act(async () => {
      button.focus();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await act(async () => {
      button.blur();
    });
    fireEvent.keyDown(document.body, { key: "Tab" });
    await act(async () => {
      button.focus();
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});
