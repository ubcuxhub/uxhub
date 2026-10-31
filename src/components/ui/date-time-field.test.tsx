// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DATE_INPUT_ERROR,
  END_TIME_ERROR,
  type IsoDate,
  type WallTime,
} from "@/lib/date-input";

import { DateField, TimeField } from "./date-time-field";

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

function Time_({
  initial = null,
  after,
  onValidityChange,
}: {
  initial?: WallTime | null;
  after?: WallTime;
  onValidityChange?: (error: string | null) => void;
}) {
  const [value, setValue] = useState<WallTime | null>(initial);
  return (
    <TimeField
      aria-label="Time"
      value={value}
      onValueChange={setValue}
      onValidityChange={onValidityChange}
      after={after}
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

describe("TimeField", () => {
  it("reads a bare 9 as 9:00 PM", () => {
    render(<Time_ />);
    const input = screen.getByRole("combobox", { name: "Time" }) as HTMLInputElement;
    typeAndBlur(input, "9");
    expect(input.value).toBe("9:00 PM");
  });

  it("takes the first match after the start in end mode", () => {
    render(<Time_ after="09:00" />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    typeAndBlur(input, "11");
    expect(input.value).toBe("11:00 AM");
  });

  it("reports an end time before the start, and clears it when fixed", () => {
    const onValidityChange = vi.fn();
    render(<Time_ after="09:00" initial="08:30" onValidityChange={onValidityChange} />);
    const input = screen.getByRole("combobox");
    expect(onValidityChange).toHaveBeenLastCalledWith(END_TIME_ERROR);
    expect(input.getAttribute("aria-invalid")).toBe("true");

    typeAndBlur(input, "10:30 am");
    expect(onValidityChange).toHaveBeenLastCalledWith(null);
  });

  it("rejects text that isn't a time", () => {
    const onValidityChange = vi.fn();
    render(<Time_ onValidityChange={onValidityChange} />);
    typeAndBlur(screen.getByRole("combobox"), "lunch");
    expect(onValidityChange).toHaveBeenLastCalledWith("Use a real time, like 9:00 AM.");
  });

  it("moves aria-activedescendant with the arrows and accepts with Enter", async () => {
    render(<Time_ initial="09:00" />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const listbox = await screen.findByRole("listbox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);

    const options = screen.getAllByRole("option");
    // Opens on the current value, 9:00 AM.
    expect(input.getAttribute("aria-activedescendant")).toBe(options[36].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[37].id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[38].id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[37].id);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(input.value).toBe("9:15 AM");
    expect(document.activeElement).toBe(input);
  });

  it("closes on Escape and keeps focus in the input", async () => {
    render(<Time_ initial="09:00" />);
    const input = screen.getByRole("combobox");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await screen.findByRole("listbox");

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  it("lists end times after the start with durations", async () => {
    render(<Time_ after="10:00" />);
    const input = screen.getByRole("combobox");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await screen.findByRole("listbox");

    const first = screen.getAllByRole("option")[0];
    expect(first.textContent).toBe("10:15 AM15 min");
    expect(screen.getByText("Pacific Time")).not.toBeNull();
  });

  it("picks an option by click", async () => {
    render(<Time_ />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Choose time" }));
    const option = await screen.findByRole("option", { name: "1:30 PM" });
    act(() => option.click());
    await waitFor(() => expect(input.value).toBe("1:30 PM"));
  });
});
