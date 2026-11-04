// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

afterEach(cleanup);

describe("Checkbox", () => {
  it("reports the new checked state through onCheckedChange", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Agree" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("works uncontrolled, with no handler at all", () => {
    render(<Checkbox aria-label="Agree" defaultChecked />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
  });

  it("follows a controlled `checked`", () => {
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return <Checkbox aria-label="Agree" checked={checked} onCheckedChange={setChecked} />;
    }
    render(<Controlled />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it("warns about a `checked` that nothing can change", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Checkbox aria-label="Stuck" checked />);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("sets the DOM indeterminate state from the prop", () => {
    const { rerender } = render(<Checkbox aria-label="All" indeterminate />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    rerender(<Checkbox aria-label="All" indeterminate={false} />);
    expect(box.indeterminate).toBe(false);
  });

  it("forwards its ref and is a `peer` with a slot name", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox aria-label="Agree" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("checkbox"));
    expect(ref.current?.dataset.slot).toBe("checkbox");
    expect(ref.current?.className.split(/\s+/)).toContain("peer");
  });

  it("dims a following Label when disabled (peer-disabled)", () => {
    render(
      <>
        <Checkbox id="c" disabled />
        <Label htmlFor="c">Subscribe</Label>
      </>,
    );
    expect(screen.getByText("Subscribe").className).toContain("peer-disabled:");
    expect(screen.getByRole("checkbox").className.split(/\s+/)).toContain("peer");
  });
});
