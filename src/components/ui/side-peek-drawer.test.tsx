// @vitest-environment jsdom

import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidePeekDrawer, SidePeekDrawerBody, SidePeekDrawerContent, SidePeekDrawerHeader, SidePeekDrawerTitle } from "./side-peek-drawer";

afterEach(cleanup);

function Example({ dirty = false, onOpenChange = () => {} }: { dirty?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  const rowRef = createRef<HTMLButtonElement>();
  return (
    <>
      <button ref={rowRef} type="button" onClick={() => setOpen(true)}>Jane row</button>
      <SidePeekDrawer open={open} onOpenChange={(next) => { onOpenChange(next); setOpen(next); }} dirty={dirty} returnFocusRef={rowRef}>
        <SidePeekDrawerContent aria-describedby={undefined}>
          <SidePeekDrawerHeader />
          <SidePeekDrawerBody><SidePeekDrawerTitle>Jane Smith</SidePeekDrawerTitle><button type="button">Last action</button></SidePeekDrawerBody>
        </SidePeekDrawerContent>
      </SidePeekDrawer>
    </>
  );
}

describe("SidePeekDrawer", () => {
  it("focuses the title on open and returns focus to the row after a clean close", async () => {
    const onOpenChange = vi.fn();
    render(<Example onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Jane Smith")));
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Jane row" })));
  });

  it("asks before discarding dirty edits and preserves the panel when cancelled", async () => {
    const onOpenChange = vi.fn();
    render(<Example dirty onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Jane Smith" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Jane row" })));
  });

  it("opens the discard confirmation on Escape when dirty", () => {
    render(<Example dirty />);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Jane Smith" }), { key: "Escape" });
    expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
  });

  it("wraps Tab within the panel while leaving the page nonmodal", () => {
    render(<Example />);
    expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull();
    const first = screen.getByRole("button", { name: "Close panel (Esc)" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    const title = screen.getByText("Jane Smith");
    title.focus();
    fireEvent.keyDown(title, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
