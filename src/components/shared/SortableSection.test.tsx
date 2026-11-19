// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SortableSection } from "./SortableSection";
afterEach(cleanup);
it("keeps handle keyboard movement separate from disclosure and respects boundaries", () => {
  const move = vi.fn(); const toggle = vi.fn();
  render(<SortableSection title="Judges" countLabel="2 people" index={0} count={2} open={false} onOpenChange={toggle} onMove={move} onDragStart={vi.fn()} onDrop={vi.fn()}><label>Name<input /></label></SortableSection>);
  expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  expect(screen.getByText("1")).toBeTruthy();
  expect(screen.queryByText("1 of 2")).toBeNull();
  const handle = screen.getByRole("button", { name: "Drag Judges to reorder" });
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  expect(move).not.toHaveBeenCalled();
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(move).toHaveBeenCalledWith(1); expect(toggle).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { expanded: false }));
  expect(toggle).toHaveBeenCalledWith(true);
});
it("accepts matching drags across the card and previews before/after insertion", () => {
  const drop = vi.fn();
  const { container } = render(<SortableSection title="Mentors" countLabel="1 person" index={1} count={3} open dragType="application/x-section" onOpenChange={vi.fn()} onMove={vi.fn()} onDragStart={vi.fn()} onDrop={drop}><label>Name<input /></label></SortableSection>);
  const card = container.querySelector('[data-slot="card"]')!;
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 100, height: 400 } as DOMRect);
  const dataTransfer = { types: ["application/x-section"], dropEffect: "none" };
  const drag = (type: string, y: number, data = dataTransfer) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { clientY: { value: y }, dataTransfer: { value: data } });
    fireEvent(card, event);
    return event;
  };
  expect(drag("dragover", 180).defaultPrevented).toBe(true);
  expect(container.querySelector('[data-drop-indicator="before"]')).toBeTruthy();
  drag("dragover", 420);
  expect(container.querySelector('[data-drop-indicator="after"]')).toBeTruthy();
  drag("drop", 420);
  expect(drop.mock.calls[0][1]).toBe("after");
  expect(container.querySelector("[data-drop-indicator]")).toBeNull();
  drag("dragover", 180, { types: ["application/x-entry"], dropEffect: "none" });
  expect(container.querySelector("[data-drop-indicator]")).toBeNull();
  expect(drag("drop", 180, { types: ["application/x-entry"], dropEffect: "none" }).defaultPrevented).toBe(false);
  expect(drop).toHaveBeenCalledTimes(1);
  drag("dragover", 180);
  fireEvent.dragEnd(document);
  expect(container.querySelector("[data-drop-indicator]")).toBeNull();
});

it("disables a lone drag handle and bounds keyboard movement at the bottom", () => {
  const move = vi.fn();
  const { rerender } = render(<SortableSection title="Sponsors" countLabel="1 sponsor" index={0} count={1} open onOpenChange={vi.fn()} onMove={move} onDragStart={vi.fn()} onDrop={vi.fn()}>Entry</SortableSection>);
  expect((screen.getByRole("button", { name: "Drag Sponsors to reorder" }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<SortableSection title="Sponsors" countLabel="1 sponsor" index={1} count={2} open onOpenChange={vi.fn()} onMove={move} onDragStart={vi.fn()} onDrop={vi.fn()}>Entry</SortableSection>);
  const handle = screen.getByRole("button", { name: "Drag Sponsors to reorder" });
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(move).not.toHaveBeenCalled();
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  expect(move).toHaveBeenCalledWith(0);
});
