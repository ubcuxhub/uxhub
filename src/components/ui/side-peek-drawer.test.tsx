// @vitest-environment jsdom

import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchField } from "@/components/ui/search-field";

import { SidePeekDrawer, SidePeekDrawerBody, SidePeekDrawerContent, SidePeekDrawerHeader, SidePeekDrawerTitle } from "./side-peek-drawer";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

function Example({
  dirty = false,
  onOpenChange = () => {},
  withReturnRef = true,
  fullPageHref,
  inDrawer,
}: {
  dirty?: boolean;
  onOpenChange?: (open: boolean) => void;
  withReturnRef?: boolean;
  fullPageHref?: string;
  inDrawer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const rowRef = createRef<HTMLButtonElement>();
  return (
    <>
      <button ref={rowRef} type="button" onClick={() => setOpen(true)}>Jane row</button>
      <SidePeekDrawer open={open} onOpenChange={(next) => { onOpenChange(next); setOpen(next); }} dirty={dirty} returnFocusRef={withReturnRef ? rowRef : undefined}>
        <SidePeekDrawerContent aria-describedby={undefined}>
          <SidePeekDrawerHeader fullPageHref={fullPageHref} />
          <SidePeekDrawerBody><SidePeekDrawerTitle>Jane Smith</SidePeekDrawerTitle>{inDrawer}<button type="button">Last action</button></SidePeekDrawerBody>
        </SidePeekDrawerContent>
      </SidePeekDrawer>
    </>
  );
}

function stubPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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

  it("puts focus back inside the panel after Keep editing", async () => {
    render(<Example dirty />);
    const close = screen.getByRole("button", { name: "Close panel (Esc)" });
    close.focus();
    fireEvent.click(close);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  describe("full-page link", () => {
    it("asks first when dirty, and navigates only after Discard", () => {
      const onOpenChange = vi.fn();
      render(<Example dirty fullPageHref="/admin/users/1" onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByRole("link", { name: "Open as full page" }));
      expect(screen.getByRole("heading", { name: "Discard changes?" })).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("link", { name: "Open as full page" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
      expect(push).toHaveBeenCalledWith("/admin/users/1");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("navigates without asking when clean, and leaves modified clicks to the browser", () => {
      render(<Example fullPageHref="/admin/users/1" />);
      const link = screen.getByRole("link", { name: "Open as full page" });
      expect(fireEvent.click(link)).toBe(true);
      expect(screen.queryByRole("heading", { name: "Discard changes?" })).toBeNull();
      cleanup();
      render(<Example dirty fullPageHref="/admin/users/1" />);
      expect(fireEvent.click(screen.getByRole("link", { name: "Open as full page" }), { ctrlKey: true })).toBe(true);
      expect(screen.queryByRole("heading", { name: "Discard changes?" })).toBeNull();
    });
  });

  describe("Escape", () => {
    it("clears an outside SearchField and keeps the panel open", () => {
      function WithSearch() {
        const [query, setQuery] = useState("jane");
        return (
          <>
            <SearchField label="Search users" value={query} onValueChange={setQuery} />
            <Example />
          </>
        );
      }
      render(<WithSearch />);
      const search = screen.getByRole("searchbox", { name: "Search users" }) as HTMLInputElement;
      search.focus();
      fireEvent.keyDown(search, { key: "Escape" });
      expect(search.value).toBe("");
      expect(screen.getByRole("dialog", { name: "Jane Smith" })).toBeTruthy();
    });

    it("ignores Escape pressed on another page control", () => {
      const onOpenChange = vi.fn();
      render(<Example onOpenChange={onOpenChange} />);
      const row = screen.getByRole("button", { name: "Jane row" });
      row.focus();
      fireEvent.keyDown(row, { key: "Escape" });
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Jane Smith" })).toBeTruthy();
    });

    it("closes on Escape when nothing is focused", () => {
      const onOpenChange = vi.fn();
      render(<Example onOpenChange={onOpenChange} />);
      (document.activeElement as HTMLElement | null)?.blur();
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("leaves Escape to a data-escape-clears field that has text, then closes once it is empty", () => {
      const onOpenChange = vi.fn();
      render(
        <Example onOpenChange={onOpenChange} inDrawer={<div data-escape-clears><input aria-label="Filter" defaultValue="abc" /></div>} />,
      );
      const field = screen.getByRole("textbox", { name: "Filter" }) as HTMLInputElement;
      field.focus();
      fireEvent.keyDown(field, { key: "Escape" });
      expect(onOpenChange).not.toHaveBeenCalled();
      field.value = "";
      fireEvent.keyDown(field, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("focus return", () => {
    it("falls back to the element focused before opening when there is no returnFocusRef", async () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>Open Jane</button>
            <SidePeekDrawer open={open} onOpenChange={setOpen}>
              <SidePeekDrawerContent aria-describedby={undefined}>
                <SidePeekDrawerHeader />
                <SidePeekDrawerBody><SidePeekDrawerTitle>Jane Smith</SidePeekDrawerTitle></SidePeekDrawerBody>
              </SidePeekDrawerContent>
            </SidePeekDrawer>
          </>
        );
      }
      render(<Harness />);
      const opener = screen.getByRole("button", { name: "Open Jane" });
      opener.focus();
      fireEvent.click(opener);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Jane Smith")));
      fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
      await waitFor(() => expect(document.activeElement).toBe(opener));
    });
  });

  describe("nonmodal focus", () => {
    it("lets Tab leave the panel instead of wrapping, and sends Shift+Tab back to the row", () => {
      render(<Example />);
      expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull();
      const first = screen.getByRole("button", { name: "Close panel (Esc)" });
      const last = screen.getByRole("button", { name: "Last action" });
      last.focus();
      // fireEvent returns false when the keystroke was default-prevented; a free Tab is not.
      expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
      expect(document.activeElement).toBe(last);
      first.focus();
      expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Jane row" }));
    });

    it("keeps the page reachable to assistive tech at desktop width", () => {
      stubPhone(false);
      render(<Example />);
      expect(screen.getByRole("button", { name: "Jane row" })).toBeTruthy();
    });
  });

  describe("phone width", () => {
    it("is modal: the page behind is hidden from assistive tech", () => {
      stubPhone(true);
      render(<Example />);
      expect(screen.queryByRole("button", { name: "Jane row" })).toBeNull();
      expect(screen.getByRole("dialog", { name: "Jane Smith" })).toBeTruthy();
    });
  });
});
