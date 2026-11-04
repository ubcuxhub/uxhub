// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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

function Example({
  defaultOpen,
  onDelete = () => {},
}: {
  defaultOpen?: boolean;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger>Actions for UXathon</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>UXathon 2026</DropdownMenuLabel>
        <DropdownMenuItem>
          Edit event
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Add to calendar</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Pin to dashboard</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("renders a menu of menu items when open", () => {
    render(<Example defaultOpen />);

    expect(screen.getByRole("menu"));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Edit event⌘E",
      "Add to calendar",
      "Delete event",
    ]);
    expect(screen.getByRole("menuitemcheckbox", { name: "Pin to dashboard" }).getAttribute("aria-checked")).toBe("true");
  });

  it("styles the destructive item, and marks the disabled one", () => {
    render(<Example defaultOpen />);

    const destructive = screen.getByRole("menuitem", { name: "Delete event" });
    expect(destructive.getAttribute("data-variant")).toBe("destructive");
    expect(destructive.className).toContain("data-[variant=destructive]:text-destructive");
    expect(screen.getByRole("menuitem", { name: /^Edit event/ }).getAttribute("data-variant")).toBe("default");
    expect(screen.getByRole("menuitem", { name: "Add to calendar" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("opens from the keyboard and moves with the arrows, skipping disabled items", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for UXathon" });
    trigger.focus();

    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("menu");

    const edit = screen.getByRole("menuitem", { name: /^Edit event/ });
    await waitFor(() => expect(document.activeElement).toBe(edit));

    fireEvent.keyDown(edit, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Pin to dashboard" })),
    );

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete event" })),
    );
  });

  it("jumps by typeahead", async () => {
    render(<Example defaultOpen />);
    const edit = screen.getByRole("menuitem", { name: /^Edit event/ });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("menu")));

    fireEvent.keyDown(screen.getByRole("menu"), { key: "d" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete event" })),
    );
    expect(document.activeElement).not.toBe(edit);
  });

  it("runs onSelect and closes when Enter is pressed on an item", async () => {
    const onDelete = vi.fn();
    render(<Example defaultOpen onDelete={onDelete} />);
    const item = screen.getByRole("menuitem", { name: "Delete event" });
    item.focus();

    fireEvent.keyDown(item, { key: "Enter" });

    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for UXathon" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = await screen.findByRole("menu");

    await act(async () => {
      fireEvent.keyDown(menu, { key: "Escape" });
    });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
