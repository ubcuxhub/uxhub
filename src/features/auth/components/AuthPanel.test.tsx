// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthPanel } from "./AuthPanel";

afterEach(cleanup);

describe("AuthPanel", () => {
  it("renders the title as the page heading, with its description", () => {
    render(
      <AuthPanel title="Sign in" description="Sign in to the UBC UX Hub Portal.">
        <form aria-label="Sign in form" />
      </AuthPanel>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("Sign in to the UBC UX Hub Portal.")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Sign in form" })).toBeTruthy();
  });

  it("leaves out the step row and art unless given", () => {
    const { container } = render(<AuthPanel title="Sign in">x</AuthPanel>);
    expect(container.querySelector("[data-slot=auth-panel-illustration]")).toBeNull();
    expect(container.querySelector("[data-slot=auth-panel-header] p")).toBeNull();
  });

  it("puts the illustration first, then the step label and its action above the heading", () => {
    const { container } = render(
      <AuthPanel
        title="Choose a photo"
        illustration={<span data-testid="art" />}
        stepLabel="Step 2 of 3"
        stepAction={<button type="button">Back</button>}
      >
        x
      </AuthPanel>,
    );
    const order = [
      screen.getByTestId("art"),
      screen.getByRole("button", { name: "Back" }),
      screen.getByText("Step 2 of 3"),
      screen.getByRole("heading", { level: 1 }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(container.firstElementChild?.className).toContain("max-w-[600px]");
  });

  it("exposes a script-focusable heading for step changes", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <AuthPanel title="Any dietary needs?" headingRef={ref} size="wide">
        x
      </AuthPanel>,
    );
    expect(ref.current?.tagName).toBe("H1");
    expect(ref.current?.tabIndex).toBe(-1);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});
