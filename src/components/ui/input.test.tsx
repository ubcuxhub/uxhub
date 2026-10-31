// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Mail } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";

afterEach(cleanup);

describe("Input without leadingIcon", () => {
  // Pinned from the markup before `leadingIcon` existed: about 50 callers
  // render this, so the DOM must not drift.
  it("renders exactly the bare <input>", () => {
    const { container } = render(
      <Input aria-label="Name" placeholder="Enter your name" className="extra" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<input class="flex h-11 w-full rounded-full border border-border bg-background px-5 py-1 text-body text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-table file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground sm:h-(--size-control) extra" aria-label="Name" placeholder="Enter your name">"`);
  });

  it("renders a bare <input> for type=number and aria-invalid", () => {
    const { container } = render(
      <Input aria-label="Seats" type="number" defaultValue={40} aria-invalid disabled />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<input class="flex h-11 w-full rounded-full border border-border bg-background px-5 py-1 text-body text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-table file:text-foreground placeholder:text-muted-foreground focus-visible:focus-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled disabled:text-disabled-foreground disabled:placeholder:text-disabled-foreground sm:h-(--size-control)" aria-label="Seats" aria-invalid="true" disabled="" type="number" value="40">"`);
  });

  it("has no wrapper, and the root is the input", () => {
    const { container } = render(<Input aria-label="Name" />);
    expect(container.firstElementChild?.tagName).toBe("INPUT");
    expect(container.querySelector("[data-slot=input-wrapper]")).toBeNull();
  });
});

describe("Input with leadingIcon", () => {
  it("wraps the input and an aria-hidden icon", () => {
    const { container } = render(
      <Input aria-label="Email" leadingIcon={Mail} wrapperClassName="w-64" />,
    );
    const wrapper = container.querySelector("[data-slot=input-wrapper]");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain("w-64");
    expect(wrapper?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper?.querySelector("input")).toBe(screen.getByRole("textbox", { name: "Email" }));
  });

  it("puts className on the <input> and pads it for the icon", () => {
    render(<Input aria-label="Email" leadingIcon={Mail} className="extra" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("extra");
    expect(input.className).toContain("pl-11");
  });

  it("forwards the ref to the <input>", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Email" leadingIcon={Mail} ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox"));
  });
});
