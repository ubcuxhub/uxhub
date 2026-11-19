// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.clearAllMocks(); });
function link(path: string) { const anchor = document.createElement("a"); anchor.href = path; document.body.append(anchor); return anchor; }
describe("event navigation protection", () => {
  it("opens a dialog for a leaving link and preserves work on cancel", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true, useRef(false)));
    fireEvent.click(link("/admin/events"));
    expect(result.current.open).toBe(true);
    expect(push).not.toHaveBeenCalled();
    act(() => result.current.cancel());
    expect(result.current.open).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
  it("leaves exactly once after explicit discard", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true, useRef(false)));
    fireEvent.click(link("/admin/events"));
    act(() => result.current.leave());
    expect(push).toHaveBeenCalledExactlyOnceWith("/admin/events");
    expect(result.current.open).toBe(false);
  });
  it("does not treat same-page section jumps as leaving", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true, useRef(false)));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link(`${location.pathname}#builder-description`).dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(result.current.open).toBe(false);
  });
  it("retains native tab-close protection only while dirty", () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty, useRef(false)), { initialProps: { dirty: true } });
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    rerender({ dirty: false });
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
});


it("blocks cancellable browser traversal and replays its exact entry after discard", () => {
  const navigation = Object.assign(new EventTarget(), { traverseTo: vi.fn() });
  Object.defineProperty(window, "navigation", { configurable: true, value: navigation });
  try {
    const { result } = renderHook(() => useUnsavedChangesGuard(true, useRef(false)));
    const event = Object.assign(new Event("navigate", { cancelable: true }), { navigationType: "traverse", destination: { url: new URL("/admin/events", location.origin).href, key: "previous-entry" } });
    act(() => { navigation.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.open).toBe(true);
    act(() => result.current.leave());
    expect(navigation.traverseTo).toHaveBeenCalledExactlyOnceWith("previous-entry");
  } finally { Object.defineProperty(window, "navigation", { configurable: true, value: undefined }); }
});
