// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuccessOverlay } from "./SuccessOverlay";

afterEach(cleanup);

describe("SuccessOverlay", () => {
  it("is a named, described modal dialog that holds focus", () => {
    render(<SuccessOverlay message="The application was accepted." onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Success" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe(
      "The application was accepted.",
    );
    expect(document.activeElement).toBe(dialog);
  });

  it("closes on Esc", () => {
    const onClose = vi.fn();
    render(<SuccessOverlay message="Done" onClose={onClose} />);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the Close button and from the scrim, but not from the panel", () => {
    const onClose = vi.fn();
    render(<SuccessOverlay message="Done" onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps Tab on its Close button", () => {
    render(<SuccessOverlay message="Done" onClose={() => {}} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("gives focus back to the element that had it", () => {
    render(<button type="button">Accept</button>);
    const opener = screen.getByRole("button", { name: "Accept" });
    opener.focus();
    const { unmount } = render(<SuccessOverlay message="Done" onClose={() => {}} />);
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
  });
});
