// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Slider } from "./slider";

afterEach(cleanup);

const zoom = (props: Partial<React.ComponentProps<typeof Slider>> = {}) => (
  <Slider
    aria-label="Zoom"
    min={100}
    max={300}
    step={10}
    defaultValue={140}
    formatValue={(value) => `${value}%`}
    {...props}
  />
);

describe("Slider", () => {
  it("is a named native range with the formatted value as text", () => {
    render(zoom());
    const slider = screen.getByRole("slider", { name: "Zoom" });
    expect(slider.tagName).toBe("INPUT");
    expect(slider.getAttribute("type")).toBe("range");
    expect(slider.getAttribute("aria-valuetext")).toBe("140%");
    expect(document.querySelector("output")?.textContent).toBe("140%");
  });

  it("opens at min when there is no value", () => {
    render(<Slider aria-label="Volume" />);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0");
  });

  it("commits changes and updates the readout", () => {
    const onValueChange = vi.fn();
    render(zoom({ onValueChange }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "200" } });
    expect(onValueChange).toHaveBeenLastCalledWith(200);
    expect(document.querySelector("output")?.textContent).toBe("200%");
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("200%");
  });

  it("PageUp and PageDown move ten steps", () => {
    const onValueChange = vi.fn();
    render(zoom({ onValueChange }));
    const slider = screen.getByRole("slider");

    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(240);
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(onValueChange).toHaveBeenLastCalledWith(140);
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(onValueChange).toHaveBeenLastCalledWith(100);
  });

  it("clamps at max and min without firing past the end", () => {
    const onValueChange = vi.fn();
    render(zoom({ defaultValue: 250, onValueChange }));
    const slider = screen.getByRole("slider");

    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(300);
    onValueChange.mockClear();
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("works controlled", () => {
    function Controlled() {
      const [value, setValue] = useState(120);
      return zoom({ value, onValueChange: setValue, defaultValue: undefined });
    }
    render(<Controlled />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "PageUp" });
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("220");
  });

  it("snaps page steps to fractional steps without float noise", () => {
    const onValueChange = vi.fn();
    render(
      <Slider aria-label="Gap" min={0} max={5} step={0.1} defaultValue={0.3} onValueChange={onValueChange} />,
    );
    fireEvent.keyDown(screen.getByRole("slider"), { key: "PageUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(1.3);
  });

  it("hides the readout with showValue={false} and disables with disabled", () => {
    render(zoom({ showValue: false, disabled: true }));
    expect(document.querySelector("output")).toBeNull();
    expect((screen.getByRole("slider") as HTMLInputElement).disabled).toBe(true);
  });

  it("lets a caller's onKeyDown prevent the page step", () => {
    const onValueChange = vi.fn();
    render(zoom({ onValueChange, onKeyDown: (event) => event.preventDefault() }));
    fireEvent.keyDown(screen.getByRole("slider"), { key: "PageUp" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("clamps a value outside the range before drawing anything from it", () => {
    render(zoom({ defaultValue: 400 }));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("300");
    expect(slider.getAttribute("aria-valuetext")).toBe("300%");
    expect(document.querySelector("output")?.textContent).toBe("300%");
    expect(slider.style.getPropertyValue("--fill")).toContain("* 1)");
  });

  it("clamps up to min, and snaps an off-step value to the step grid", () => {
    const { rerender } = render(zoom({ value: 20, onValueChange: () => {}, defaultValue: undefined }));
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("100");
    rerender(zoom({ value: 147, onValueChange: () => {}, defaultValue: undefined }));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("150");
    expect(slider.getAttribute("aria-valuetext")).toBe("150%");
  });

  it("computes Page Up from the clamped value, not the raw one", () => {
    const onValueChange = vi.fn();
    render(zoom({ value: 150 + 500, onValueChange, defaultValue: undefined }));
    fireEvent.keyDown(screen.getByRole("slider"), { key: "PageDown" });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(200);
  });
});
