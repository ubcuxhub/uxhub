// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- the guard handles any anchor; plain ones keep the fixture free of Next's router */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useNavigationGuard } from "./use-navigation-guard";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function Fixture({ when, onBlocked, onPageClick }: { when: boolean; onBlocked: (href: string) => void; onPageClick?: () => void }) {
  const { release } = useNavigationGuard({ when, onBlocked });
  return (
    <div onClick={onPageClick}>
      <a href="/admin/users/2?tab=history">Another user</a>
      <a href="/admin/users/1">This page</a>
      <a href="#details">Hash</a>
      <a href="https://example.com/">Elsewhere</a>
      <a href="/admin/events" target="_blank">New tab</a>
      <a href="/export.csv" download>Download</a>
      <button type="button" onClick={release}>Release</button>
    </div>
  );
}

function unload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useNavigationGuard", () => {
  it("does nothing while `when` is false", () => {
    const onBlocked = vi.fn();
    render(<Fixture when={false} onBlocked={onBlocked} />);
    expect(fireEvent.click(screen.getByText("Another user"))).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(unload()).toBe(false);
  });

  it("holds back a same-tab click on another page of the app and reports its href", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    const onBlocked = vi.fn();
    const onPageClick = vi.fn();
    render(<Fixture when onBlocked={onBlocked} onPageClick={onPageClick} />);
    expect(fireEvent.click(screen.getByText("Another user"))).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith("/admin/users/2?tab=history");
    // Prevented, not stopped: the page's own handlers (and Next's Link, which
    // checks defaultPrevented) still see the click.
    expect(onPageClick).toHaveBeenCalled();
  });

  it("leaves new-tab, download, external, hash and same-page clicks alone", () => {
    window.history.replaceState(null, "", "/admin/users/1");
    const onBlocked = vi.fn();
    render(<Fixture when onBlocked={onBlocked} />);
    expect(fireEvent.click(screen.getByText("Another user"), { metaKey: true })).toBe(true);
    expect(fireEvent.click(screen.getByText("Another user"), { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(screen.getByText("Another user"), { button: 1 })).toBe(true);
    for (const name of ["This page", "Hash", "Elsewhere", "New tab", "Download"]) {
      expect(fireEvent.click(screen.getByText(name)), name).toBe(true);
    }
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("ignores a click something else already prevented", () => {
    const onBlocked = vi.fn();
    render(<Fixture when onBlocked={onBlocked} />);
    const link = screen.getByText("Another user");
    // A window capture listener runs before the guard's document one.
    const preventFirst = (event: Event) => event.preventDefault();
    window.addEventListener("click", preventFirst, { capture: true });
    fireEvent.click(link);
    window.removeEventListener("click", preventFirst, { capture: true });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("asks before unload while guarding", () => {
    render(<Fixture when onBlocked={() => {}} />);
    expect(unload()).toBe(true);
  });

  it("stands down after release, and arms again when `when` turns true again", () => {
    const onBlocked = vi.fn();
    const { rerender } = render(<Fixture when onBlocked={onBlocked} />);
    fireEvent.click(screen.getByText("Release"));
    expect(unload()).toBe(false);
    expect(fireEvent.click(screen.getByText("Another user"))).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();

    rerender(<Fixture when={false} onBlocked={onBlocked} />);
    rerender(<Fixture when onBlocked={onBlocked} />);
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByText("Another user"));
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("removes its listeners on unmount", () => {
    const { unmount } = render(<Fixture when onBlocked={() => {}} />);
    unmount();
    expect(unload()).toBe(false);
  });
});
