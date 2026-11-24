// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Mail } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";

afterEach(cleanup);

describe("Input without leadingIcon", () => {
  // About 50 callers render this, so it must stay a bare <input>.
  it("renders a bare <input> with the caller's class and attributes", () => {
    const { container } = render(
      <Input aria-label="Name" placeholder="Enter your name" className="extra" />,
    );
    expect(container.childElementCount).toBe(1);
    const input = container.firstElementChild as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.childElementCount).toBe(0);
    expect(input.className.split(/\s+/)).toContain("extra");
    expect(input.placeholder).toBe("Enter your name");
  });

  it("keeps type, invalid and disabled on the bare <input>, styled by state", () => {
    render(<Input aria-label="Seats" type="number" defaultValue={40} aria-invalid disabled />);
    const input = screen.getByRole("spinbutton", { name: "Seats" }) as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.value).toBe("40");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.disabled).toBe(true);
    expect(input.className).toContain("aria-invalid:border-destructive");
    expect(input.className).toContain("focus-visible:focus-ring");
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
