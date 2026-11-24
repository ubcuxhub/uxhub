// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionSearch, type ActionSearchProps } from "./ActionSearch";

afterEach(cleanup);
const select = vi.fn();
function Example(props: Partial<ActionSearchProps>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  return <><ActionSearch label="Search" query={query} onQueryChange={setQuery} open={open} onOpenChange={setOpen}
    groups={[{ label: "Suggested", items: [{ id: "disabled", label: "Export", disabled: true }, { id: "events", label: "Events" }, { id: "stats", label: "Statistics" }] }]}
    onSelect={select} {...props} /><button>Outside</button></>;
}
describe("ActionSearch", () => {
  it("requires selection, skips disabled items, clears and dismisses without changing typed text", async () => {
    select.mockReset();
    render(<Example />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)?.textContent).toBe("Events");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ id: "events" }));
    fireEvent.change(input, { target: { value: "typed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect((input as HTMLInputElement).value).toBe("typed");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(input);
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
  it("exposes loading, empty and failure/retry with no stale selectable rows", async () => {
    const retry = vi.fn();
    const { rerender } = render(<Example loading />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByText("Searching…")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
    rerender(<Example groups={[]} />);
    expect(screen.getByText("No results")).toBeTruthy();
    rerender(<Example error="Unavailable" onRetry={retry} contextAction={{ label: "Back", onSelect: vi.fn() }} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(document.activeElement!);
    expect(retry).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });
  it("makes scoped navigation keyboard reachable and restores input focus", async () => {
    const back = vi.fn();
    render(<Example contextAction={{ label: "Back to all results", onSelect: back }} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back to all results" }));
    fireEvent.click(document.activeElement!);
    expect(back).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(document.activeElement).toBe(input);
  });
  it("supports pointer selection and outside dismissal", async () => {
    select.mockReset();
    render(<Example />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Export" }));
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Events" }));
    expect(select).toHaveBeenCalledOnce();
    // Radix defers outside dismissal until the click following pointer-down.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), { pointerType: "mouse" });
    fireEvent.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
});
