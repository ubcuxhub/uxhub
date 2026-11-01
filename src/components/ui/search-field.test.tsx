// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchField } from "./search-field";

afterEach(cleanup);

describe("SearchField", () => {
  it("is a named search box with no clear button while empty", () => {
    render(<SearchField label="Search users" />);
    expect(screen.getByRole("searchbox", { name: "Search users" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("shows the clear button once there is text, and clearing refocuses", () => {
    const onValueChange = vi.fn();
    render(<SearchField label="Search users" onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "alex" } });
    expect(onValueChange).toHaveBeenLastCalledWith("alex");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("works controlled", () => {
    function Controlled() {
      const [value, setValue] = useState("hi");
      return <SearchField label="Search" value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    const input = screen.getByRole("searchbox");
    expect((input as HTMLInputElement).value).toBe("hi");
    fireEvent.change(input, { target: { value: "hello" } });
    expect((input as HTMLInputElement).value).toBe("hello");
  });

  it("clears on Esc, and swallows it only when there was text", () => {
    const onValueChange = vi.fn();
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <SearchField label="Search" defaultValue="alex" onValueChange={onValueChange} />
      </div>,
    );
    const input = screen.getByRole("searchbox");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onValueChange).toHaveBeenCalledWith("");
    expect((input as HTMLInputElement).value).toBe("");
    expect(onParentKeyDown).not.toHaveBeenCalled();

    // Empty now: Esc reaches an enclosing dialog.
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onParentKeyDown).toHaveBeenCalledTimes(1);
  });

  it("marks the input so overlays leave Escape to it", () => {
    render(<SearchField label="Search" defaultValue="alex" />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.hasAttribute("data-escape-clears")).toBe(true);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("lets only the caller's own onKeyDown opt out of the clear", () => {
    const keep = (event: React.KeyboardEvent) => event.preventDefault();
    render(<SearchField label="Search" defaultValue="alex" onKeyDown={keep} />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("alex");
  });

  it("still clears when an overlay already prevented the keydown", () => {
    render(
      <div onKeyDownCapture={(event) => event.preventDefault()}>
        <SearchField label="Search" defaultValue="alex" />
      </div>,
    );
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("announces the result count", () => {
    const { rerender } = render(<SearchField label="Search" resultCount={3} />);
    expect(screen.getByRole("status").textContent).toBe("3 results");
    rerender(<SearchField label="Search" resultCount={1} />);
    expect(screen.getByRole("status").textContent).toBe("1 result");
    rerender(<SearchField label="Search" resultCount={0} />);
    expect(screen.getByRole("status").textContent).toBe("No results");
  });

  it("hides the clear button when disabled", () => {
    render(<SearchField label="Search" defaultValue="x" disabled />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});
