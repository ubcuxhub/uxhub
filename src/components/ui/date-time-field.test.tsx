// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DATE_INPUT_ERROR, type IsoDate } from "@/lib/date-input";

import { DateField } from "./date-time-field";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

afterEach(cleanup);

const today = "2026-10-31" as IsoDate;

function Date_({
  initial = null,
  onValidityChange,
  ...props
}: {
  initial?: IsoDate | null;
  onValidityChange?: (error: string | null) => void;
  min?: IsoDate;
}) {
  const [value, setValue] = useState<IsoDate | null>(initial);
  return (
    <DateField
      aria-label="Date"
      today={today}
      value={value}
      onValueChange={setValue}
      onValidityChange={onValidityChange}
      {...props}
    />
  );
}

const typeAndBlur = (input: HTMLElement, text: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
};

describe("DateField", () => {
  it("tidies typed text on blur", () => {
    render(<Date_ />);
    const input = screen.getByRole("textbox", { name: "Date" }) as HTMLInputElement;
    typeAndBlur(input, "nov 14");
    expect(input.value).toBe("Sat, Nov 14, 2026");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("calls onValidityChange with the error on a bad blur, and keeps the text", () => {
    const onValidityChange = vi.fn();
    render(<Date_ onValidityChange={onValidityChange} />);
    const input = screen.getByRole("textbox", { name: "Date" }) as HTMLInputElement;

    typeAndBlur(input, "feb 30");
    expect(onValidityChange).toHaveBeenLastCalledWith(DATE_INPUT_ERROR);
    expect(input.value).toBe("feb 30");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(input, { target: { value: "nov 14" } });
    expect(onValidityChange).toHaveBeenLastCalledWith(null);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("says why when a real date is out of range", () => {
    const onValidityChange = vi.fn();
    render(<Date_ min={today} onValidityChange={onValidityChange} />);
    typeAndBlur(screen.getByRole("textbox"), "oct 1 2026");
    expect(onValidityChange).toHaveBeenLastCalledWith(
      "Pick a date on or after Sat, Oct 31, 2026.",
    );
  });

  it("clears the value when the text is emptied", () => {
    const onValueChange = vi.fn();
    render(
      <DateField
        aria-label="Date"
        today={today}
        value="2026-11-14"
        onValueChange={onValueChange}
      />,
    );
    typeAndBlur(screen.getByRole("textbox"), "");
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("submits the ISO value through a hidden input", () => {
    const { container } = render(
      <DateField
        aria-label="Date"
        name="start_date"
        today={today}
        value="2026-11-14"
        onValueChange={() => {}}
      />,
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe("start_date");
    expect(hidden.value).toBe("2026-11-14");
  });

  it("opens the calendar on the selected day, focuses the selected day, picks, and returns focus", async () => {
    render(<Date_ initial="2026-11-14" />);
    const input = screen.getByRole("textbox", { name: "Date" });

    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    const selected = await screen.findByRole("button", { name: /November 14/ });
    await waitFor(() => expect(document.activeElement).toBe(selected));
    fireEvent.click(await screen.findByRole("button", { name: /November 15/ }));

    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect((input as HTMLInputElement).value).toBe("Sun, Nov 15, 2026");
    expect(document.activeElement).toBe(input);
  });

  it("closes on Escape with focus back in the input", async () => {
    render(<Date_ initial="2026-11-14" />);
    const input = screen.getByRole("textbox", { name: "Date" });
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    await screen.findByRole("grid");

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  it("disables days outside min", async () => {
    render(<Date_ initial="2026-11-14" min="2026-11-10" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    const early = await screen.findByRole("button", { name: /November 9/ });
    expect((early as HTMLButtonElement).disabled).toBe(true);
    const ok = await screen.findByRole("button", { name: /November 10/ });
    expect((ok as HTMLButtonElement).disabled).toBe(false);
  });
});
