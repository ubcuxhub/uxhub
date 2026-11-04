// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ColourPicker, ColourSwatch, CustomColourForm } from "./colour-picker";

afterEach(cleanup);

function Harness({
  initialValue = "#325DC4",
  initialCustom = [],
  onValueChange,
}: {
  initialValue?: string;
  initialCustom?: string[];
  onValueChange?: (hex: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [custom, setCustom] = useState(initialCustom);
  return (
    <ColourPicker
      label="Event colour"
      value={value}
      onValueChange={(hex) => {
        onValueChange?.(hex);
        setValue(hex);
      }}
      customColours={custom}
      onCustomColoursChange={setCustom}
    />
  );
}

describe("ColourSwatch", () => {
  it("is a toggle button named by `name`", () => {
    render(<ColourSwatch colour="#325DC4" name="Blue" selected />);
    expect(screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a remove button only when `onRemove` is passed", () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <ColourSwatch colour="#2F8F6B" name="Custom colour #2F8F6B" />,
    );
    expect(screen.queryByRole("button", { name: "Remove #2F8F6B" })).toBeNull();
    rerender(
      <ColourSwatch colour="#2F8F6B" name="Custom colour #2F8F6B" onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove #2F8F6B" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("ColourPicker", () => {
  it("is a group named by its label, with presets in order then Add", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Event colour" });
    const names = within(group)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(["Blue", "Orchid", "Slate", "Add custom colour"]);
  });

  it("sets aria-pressed from `value` and ignores a press on the pressed swatch", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const blue = screen.getByRole("button", { name: "Blue" });
    const orchid = screen.getByRole("button", { name: "Orchid" });
    expect(blue.getAttribute("aria-pressed")).toBe("true");
    expect(orchid.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(blue);
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.click(orchid);
    expect(onValueChange).toHaveBeenCalledWith("#C983C7");
    expect(orchid.getAttribute("aria-pressed")).toBe("true");
    expect(blue.getAttribute("aria-pressed")).toBe("false");
  });

  it("removing the selected custom colour falls back to Blue", () => {
    render(<Harness initialValue="#2F8F6B" initialCustom={["#2F8F6B"]} />);
    const custom = screen.getByRole("button", { name: "Custom colour #2F8F6B" });
    expect(custom.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Remove #2F8F6B" }));
    expect(screen.queryByRole("button", { name: "Custom colour #2F8F6B" })).toBeNull();
    expect(screen.getByRole("button", { name: "Blue" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("removing an unselected custom colour keeps the selection", () => {
    const onValueChange = vi.fn();
    render(
      <Harness
        initialValue="#C983C7"
        initialCustom={["#2F8F6B"]}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove #2F8F6B" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Orchid" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("moves focus to Add after removing the last custom colour", () => {
    render(<Harness initialCustom={["#2F8F6B"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove #2F8F6B" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add custom colour" }),
    );
  });
});

describe("ColourPicker focus after removal", () => {
  const swatch = (hex: string) =>
    screen.getByRole("button", { name: `Custom colour ${hex}` });
  const remove = (hex: string) =>
    fireEvent.click(screen.getByRole("button", { name: `Remove ${hex}` }));

  it("moves focus to the swatch that slid into the removed one's place", () => {
    render(<Harness initialCustom={["#2F8F6B", "#AA3366", "#112233"]} />);
    remove("#2F8F6B");
    expect(document.activeElement).toBe(swatch("#AA3366"));
  });

  it("counts only rendered swatches when an invalid entry sits before the removed one", () => {
    render(<Harness initialCustom={["nope", "#2F8F6B", "#AA3366"]} />);
    remove("#2F8F6B");
    expect(document.activeElement).toBe(swatch("#AA3366"));
  });

  it("doesn't fire when the parent ignores the removal, nor on a later add", () => {
    function Stubborn() {
      const [custom, setCustom] = useState(["#2F8F6B"]);
      const [value, setValue] = useState("#325DC4");
      return (
        <ColourPicker
          label="Event colour"
          value={value}
          onValueChange={setValue}
          customColours={custom}
          // Rejects removals (shorter lists) but accepts additions.
          onCustomColoursChange={(next) => {
            if (next.length > custom.length) setCustom(next);
          }}
        />
      );
    }
    render(<Stubborn />);
    remove("#2F8F6B");
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Add custom colour" }),
    );

    // The user then adds a colour: focus must not jump to a swatch.
    fireEvent.click(screen.getByRole("button", { name: "Add custom colour" }));
    fireEvent.change(screen.getByLabelText("Hex"), { target: { value: "#112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Use colour" }));
    expect(document.activeElement).not.toBe(swatch("#112233"));
    expect(document.activeElement).not.toBe(swatch("#2F8F6B"));
  });

  it("still moves focus when the parent applies the removal a render later", async () => {
    function Slow() {
      const [custom, setCustom] = useState(["#2F8F6B"]);
      return (
        <ColourPicker
          label="Event colour"
          value="#325DC4"
          onValueChange={() => {}}
          customColours={custom}
          onCustomColoursChange={(next) => {
            setTimeout(() => setCustom(next), 0);
          }}
        />
      );
    }
    render(<Slow />);
    remove("#2F8F6B");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add custom colour" }),
      ),
    );
  });
});

describe("CustomColourForm", () => {
  it("shows the error for an invalid hex and does not submit it", () => {
    const onUse = vi.fn();
    render(<CustomColourForm initialColour="#2F8F6B" onUse={onUse} onCancel={vi.fn()} />);
    const input = screen.getByLabelText("Hex");

    fireEvent.change(input, { target: { value: "#2F8F6" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Use a 6-digit hex, like #325DC4.");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Use colour" }));
    expect(onUse).not.toHaveBeenCalled();
  });

  it("submits a normalized hex on Use colour and on Enter, and clears the error as you fix it", () => {
    const onUse = vi.fn();
    render(<CustomColourForm onUse={onUse} onCancel={vi.fn()} initialText="zzz" />);
    expect(screen.getByRole("alert")).toBeTruthy();

    const input = screen.getByLabelText("Hex");
    fireEvent.change(input, { target: { value: "2f8f6b" } });
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Use colour" }));
    expect(onUse).toHaveBeenLastCalledWith("#2F8F6B");

    fireEvent.change(input, { target: { value: "#abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onUse).toHaveBeenLastCalledWith("#AABBCC");
  });

  it("calls onCancel", () => {
    const onCancel = vi.fn();
    render(<CustomColourForm onUse={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
