// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CopyCode } from "./CopyCode";

afterEach(cleanup);

describe("CopyCode", () => {
  it("names its button generically by default, and takes a label", () => {
    const { rerender } = render(<CopyCode code="UXHUB-2026" />);
    expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();

    rerender(<CopyCode code="UXHUB-2026" label="Copy referral code" />);
    expect(
      screen.getByRole("button", { name: "Copy referral code" }),
    ).toBeTruthy();
  });

  it("truncates a long code inside the pill instead of pushing the button out", () => {
    const code = "UXHUB-FIGMA-STUDENT-2026-WITH-A-VERY-LONG-SUFFIX";
    const { container } = render(<CopyCode code={code} />);

    const pill = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(pill.className).toContain("min-w-48");
    expect(pill.className).toContain("max-w-full");
    expect(pill.className).not.toMatch(/(^|\s)w-48(\s|$)/);

    const text = screen.getByText(code);
    expect(text.className).toContain("truncate");
    expect(text.className).toContain("min-w-0");
    // The full code stays available on hover.
    expect(text.getAttribute("title")).toBe(code);
    expect(screen.getByRole("button").className).toContain("shrink-0");
  });
});
