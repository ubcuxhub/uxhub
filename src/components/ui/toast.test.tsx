// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sonnerMocks = vi.hoisted(() => ({
  custom: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: sonnerMocks,
}));

import { toast } from "./toast";

/** Renders what the wrapper handed to `sonner.custom`, as Sonner would with an id. */
function renderLast(toastId: string | number = "t1") {
  const [render_] = sonnerMocks.custom.mock.calls.at(-1) as [
    (id: string | number) => ReactNode,
  ];
  return render(<>{render_(toastId)}</>);
}

beforeEach(() => {
  sonnerMocks.custom.mockReturnValue("t1");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("toast", () => {
  it("returns Sonner's id and passes id and duration through", () => {
    expect(toast("Draft saved", { id: "draft", duration: 8000 })).toBe("t1");
    expect(sonnerMocks.custom).toHaveBeenCalledWith(expect.any(Function), {
      id: "draft",
      duration: 8000,
    });
  });

  it("leaves duration to the Toaster's default when not given", () => {
    toast("Draft saved");
    expect(sonnerMocks.custom.mock.calls[0][1]).toEqual({
      id: undefined,
      duration: undefined,
    });
  });

  it.each([
    ["neutral", () => toast("Message"), false],
    ["success", () => toast.success("Message"), true],
    ["error", () => toast.error("Message"), true],
  ] as const)("renders the %s tone", (tone, fire, hasMark) => {
    fire();
    const { container } = renderLast();
    expect(container.querySelector("[data-slot=toast]")).toHaveProperty(
      "dataset.tone",
      tone,
    );
    expect(Boolean(container.querySelector("[data-slot=toast-mark]"))).toBe(
      hasMark,
    );
    expect(screen.getByText("Message")).toBeTruthy();
  });

  it("shows the description only when given", () => {
    toast.success("Event published", { description: "UXathon is live." });
    renderLast();
    expect(screen.getByText("UXathon is live.")).toBeTruthy();
    cleanup();

    toast.success("Event published");
    const { container } = renderLast();
    expect(container.querySelector("[data-slot=toast-description]")).toBeNull();
  });

  it("runs the action, then dismisses that toast", () => {
    const onClick = vi.fn();
    toast.error("Couldn’t save", { action: { label: "Try again", onClick } });
    renderLast("abc");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(sonnerMocks.dismiss).toHaveBeenCalledWith("abc");
  });

  it("has a named dismiss button", () => {
    toast("Draft saved");
    renderLast("abc");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(sonnerMocks.dismiss).toHaveBeenCalledWith("abc");
  });

  it("dismisses one toast by id, or all", () => {
    toast.dismiss("abc");
    toast.dismiss();
    expect(sonnerMocks.dismiss).toHaveBeenNthCalledWith(1, "abc");
    expect(sonnerMocks.dismiss).toHaveBeenNthCalledWith(2, undefined);
  });
});
