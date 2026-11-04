// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button asChild disabled", () => {
  it("makes a link inert: aria-disabled, out of the tab order, click blocked", () => {
    const onClick = vi.fn();
    render(
      <Button asChild disabled>
        <a href="#back" onClick={onClick}>
          Back
        </a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Back" });

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.getAttribute("tabindex")).toBe("-1");

    // Enter on a link and a screen reader's activate both dispatch a click.
    // It must be cancelled before the browser follows the href.
    const notCancelled = fireEvent.click(link);
    expect(notCancelled).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("leaves an enabled link alone", () => {
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Button asChild>
        <a href="#back" onClick={onClick}>
          Back
        </a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Back" });

    expect(link.getAttribute("aria-disabled")).toBeNull();
    expect(link.getAttribute("tabindex")).toBeNull();
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("still disables a plain button natively", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });
});
