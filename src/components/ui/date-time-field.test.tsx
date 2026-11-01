// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
  name?: string;
  disabled?: boolean;
  required?: boolean;
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
  name,
  disabled,
  required,
}: {
  initial?: WallTime | null;
  after?: WallTime;
  onValidityChange?: (error: string | null) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [value, setValue] = useState<WallTime | null>(initial);
  return (
    <TimeField
      aria-label="Time"
      value={value}
      onValueChange={setValue}
      onValidityChange={onValidityChange}
      after={after}
      name={name}
      disabled={disabled}
      required={required}
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

  it("submits only the committed ISO value while edited text stays visible", () => {
    const { container } = render(
      <form>
        <Date_ initial="2026-11-14" name="start_date" />
      </form>,
    );
    const form = container.querySelector("form")!;
    const input = screen.getByRole("textbox", { name: "Date" }) as HTMLInputElement;
    const submitted = () => new FormData(form).get("start_date");

    expect(submitted()).toBe("2026-11-14");

    fireEvent.change(input, { target: { value: "feb 30" } });
    expect(input.value).toBe("feb 30");
    expect(submitted()).toBe("");
    fireEvent.blur(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.value).toBe("feb 30");
    expect(submitted()).toBe("");

    fireEvent.change(input, { target: { value: "nov 15" } });
    expect(submitted()).toBe("");
    fireEvent.blur(input);
    expect(input.value).toBe("Sun, Nov 15, 2026");
    expect(submitted()).toBe("2026-11-15");
  });

  it("omits a disabled date field from FormData", () => {
    const { container } = render(
      <form>
        <Date_ initial="2026-11-14" name="start_date" disabled />
      </form>,
    );
    expect(new FormData(container.querySelector("form")!).has("start_date")).toBe(false);
  });

  it("blocks form validation for a date draft until it commits", () => {
    const { container } = render(
      <form>
        <Date_ initial="2026-11-14" name="start_date" required />
      </form>,
    );
    const form = container.querySelector("form")!;
    const input = screen.getByRole("textbox", { name: "Date" });

    expect(form.checkValidity()).toBe(true);
    fireEvent.change(input, { target: { value: "feb 30" } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: "nov 15" } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.blur(input);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("start_date")).toBe("2026-11-15");
  });

  it("prevents Enter from submitting an enclosing form while committing a date", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Date_ />
        <button type="submit">Save</button>
      </form>,
    );
    const input = screen.getByRole("textbox", { name: "Date" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "nov 14" } });
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe("Sat, Nov 14, 2026");
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
  it("submits only a committed valid time while edited text stays visible", () => {
    const { container } = render(
      <form>
        <Time_ initial="09:00" name="start_time" />
      </form>,
    );
    const form = container.querySelector("form")!;
    const input = screen.getByRole("combobox", { name: "Time" }) as HTMLInputElement;
    const submitted = () => new FormData(form).get("start_time");

    expect(submitted()).toBe("09:00");

    fireEvent.change(input, { target: { value: "lunch" } });
    expect(input.value).toBe("lunch");
    expect(submitted()).toBe("");
    fireEvent.blur(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(submitted()).toBe("");

    fireEvent.change(input, { target: { value: "10:30 am" } });
    expect(submitted()).toBe("");
    fireEvent.blur(input);
    expect(input.value).toBe("10:30 AM");
    expect(submitted()).toBe("10:30");
  });

  it("omits a disabled time field from FormData", () => {
    const { container } = render(
      <form>
        <Time_ initial="09:00" name="start_time" disabled />
      </form>,
    );
    expect(new FormData(container.querySelector("form")!).has("start_time")).toBe(false);
  });

  it("does not submit an end time before the start", () => {
    const { container } = render(
      <form>
        <Time_ initial="08:30" after="09:00" name="end_time" />
      </form>,
    );
    expect(new FormData(container.querySelector("form")!).get("end_time")).toBe("");
    expect(container.querySelector("form")!.checkValidity()).toBe(false);
  });

  it("blocks form validation for invalid and uncommitted time drafts", () => {
    const { container } = render(
      <form>
        <Time_ initial="09:00" name="start_time" required />
      </form>,
    );
    const form = container.querySelector("form")!;
    const input = screen.getByRole("combobox", { name: "Time" });

    expect(form.checkValidity()).toBe(true);
    fireEvent.change(input, { target: { value: "lunch" } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.blur(input);
    expect(form.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: "10:30 am" } });
    expect(form.checkValidity()).toBe(false);
    fireEvent.blur(input);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("start_time")).toBe("10:30");
  });

  it("prevents Enter from submitting a form with the time list closed or open", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Time_ />
        <button type="submit">Save</button>
      </form>,
    );
    const input = screen.getByRole("combobox", { name: "Time" }) as HTMLInputElement;
    const enter = () => {
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      act(() => input.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();
    };

    fireEvent.change(input, { target: { value: "10:30 am" } });
    enter(); // list closed
    expect(input.value).toBe("10:30 AM");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    fireEvent.change(input, { target: { value: "10:07 am" } });
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    enter(); // list open, no active option
    expect(input.value).toBe("10:07 AM");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    enter(); // list open, active option
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("opens the time list near an off-grid typed draft instead of the old value", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop")!;
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
      configurable: true,
      get(this: HTMLElement) {
        const match = this.id.match(/-option-(\d+)$/);
        return match ? Number(match[1]) * 42 : 0;
      },
    });
    try {
      render(<Time_ initial="21:00" />);
      const input = screen.getByRole("combobox", { name: "Time" });
      fireEvent.change(input, { target: { value: "9:07 am" } });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const list = await screen.findByRole("listbox");
      expect(list.scrollTop).toBe(36 * 42);
    } finally {
      Object.defineProperty(HTMLElement.prototype, "offsetTop", descriptor);
    }
  });

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

describe("a value set from outside", () => {
  function Controlled({
    kind,
    onValidityChange,
  }: {
    kind: "date" | "time";
    onValidityChange: (error: string | null) => void;
  }) {
    const [date, setDate] = useState<IsoDate | null>(null);
    const [time, setTime] = useState<WallTime | null>(null);
    return (
      <form>
        {kind === "date" ? (
          <DateField
            aria-label="Field"
            name="field"
            today={today}
            value={date}
            onValueChange={setDate}
            onValidityChange={onValidityChange}
          />
        ) : (
          <TimeField
            aria-label="Field"
            name="field"
            value={time}
            onValueChange={setTime}
            onValidityChange={onValidityChange}
          />
        )}
        <button
          type="button"
          onClick={() => (kind === "date" ? setDate("2026-11-20") : setTime("22:00"))}
        >
          Set from outside
        </button>
      </form>
    );
  }

  it.each([
    ["date", "abc", "Fri, Nov 20, 2026", "2026-11-20"],
    ["time", "abc", "10:00 PM", "22:00"],
  ] as const)("clears a stale %s parse error", (kind, bad, shown, submitted) => {
    const onValidityChange = vi.fn();
    const { container } = render(
      <Controlled kind={kind} onValidityChange={onValidityChange} />,
    );
    const form = container.querySelector("form")!;
    const input = screen.getByLabelText("Field") as HTMLInputElement;

    typeAndBlur(input, bad);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(form.checkValidity()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Set from outside" }));

    expect(input.value).toBe(shown);
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(onValidityChange).toHaveBeenLastCalledWith(null);
    expect(new FormData(form).get("field")).toBe(submitted);
    expect(form.checkValidity()).toBe(true);
  });
});

describe("a yearless date in a past window", () => {
  it("reads yesterday's date as this year's when max is today", () => {
    const onValidityChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <DateField
        aria-label="Date"
        today={today}
        max={today}
        value={null}
        onValueChange={onValueChange}
        onValidityChange={onValidityChange}
      />,
    );
    typeAndBlur(screen.getByRole("textbox", { name: "Date" }), "oct 30");
    expect(onValueChange).toHaveBeenCalledWith("2026-10-30");
    expect(onValidityChange).not.toHaveBeenCalledWith(expect.any(String));
  });
});

describe("on a touch screen", () => {
  const original = window.matchMedia;
  beforeAll(() => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });
  afterAll(() => {
    window.matchMedia = original;
  });

  it("returns focus to the calendar button, not the input, after a date pick", async () => {
    render(<Date_ initial="2026-11-14" />);
    const input = screen.getByRole("textbox", { name: "Date" }) as HTMLInputElement;
    const trigger = screen.getByRole("button", { name: "Choose date" });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: /November 15/ }));

    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect(input.value).toBe("Sun, Nov 15, 2026");
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves the time input unfocused when the list opens and an option is picked", async () => {
    render(<Time_ />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: "Choose time" }));
    expect(document.activeElement).not.toBe(input);
    const option = await screen.findByRole("option", { name: "1:30 PM" });
    act(() => option.click());

    await waitFor(() => expect(input.value).toBe("1:30 PM"));
    expect(document.activeElement).not.toBe(input);
  });
});

describe("Tab out of the calendar", () => {
  function DateThenNext() {
    const [value, setValue] = useState<IsoDate | null>("2026-11-14");
    return (
      <form>
        <DateField aria-label="Date" today={today} value={value} onValueChange={setValue} />
        <input aria-label="Next field" />
      </form>
    );
  }

  it("goes on to the next field from the last control", async () => {
    render(<DateThenNext />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    await screen.findByRole("grid");
    const todayLink = screen.getByRole("button", { name: "Today" });
    todayLink.focus();

    expect(fireEvent.keyDown(todayLink, { key: "Tab" })).toBe(false);
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect(document.activeElement).toBe(screen.getByLabelText("Next field"));
  });

  it("goes back to the calendar button from the first control", async () => {
    render(<DateThenNext />);
    const trigger = screen.getByRole("button", { name: "Choose date" });
    fireEvent.click(trigger);
    const grid = await screen.findByRole("grid");
    const popover = grid.closest("[role=dialog]") as HTMLElement;
    const first = popover.querySelector<HTMLElement>("button:not([disabled])")!;
    first.focus();

    expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves Tab between the calendar's own controls alone", async () => {
    render(<DateThenNext />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    const selected = await screen.findByRole("button", { name: /November 14/ });
    await waitFor(() => expect(document.activeElement).toBe(selected));

    expect(fireEvent.keyDown(selected, { key: "Tab" })).toBe(true);
    expect(screen.queryByRole("grid")).not.toBeNull();
  });
});
