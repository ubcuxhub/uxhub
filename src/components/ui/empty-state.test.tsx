// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Calendar } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title as an h3 by default", () => {
    render(<EmptyState title="No upcoming events" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "No upcoming events" }),
    ).toBeTruthy();
  });

  it.each([["h2", 2], ["h3", 3]] as const)("titleAs=%s sets the level", (as, level) => {
    render(<EmptyState title="Nothing here" titleAs={as} />);
    expect(screen.getByRole("heading", { level })).toBeTruthy();
  });

  it("titleAs=p renders no heading", () => {
    render(<EmptyState title="Nothing here" titleAs="p" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Nothing here").tagName).toBe("P");
  });

  it("renders description, media and actions", () => {
    const { container } = render(
      <EmptyState
        title="No events"
        description="New events show up here."
        media={<Calendar />}
        actions={<button type="button">View past events</button>}
      />,
    );
    expect(screen.getByText("New events show up here.")).toBeTruthy();
    expect(container.querySelector("[data-slot=empty-state-media] svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View past events" })).toBeTruthy();
  });

  it("drops the media at inline size", () => {
    const { container } = render(
      <EmptyState size="inline" title="No events" media={<Calendar />} />,
    );
    expect(container.querySelector("[data-slot=empty-state-media]")).toBeNull();
  });

  it("omits empty parts and passes through props", () => {
    const { container } = render(
      <EmptyState title="No events" className="extra" data-testid="es" />,
    );
    expect(container.querySelector("[data-slot=empty-state-description]")).toBeNull();
    expect(container.querySelector("[data-slot=empty-state-actions]")).toBeNull();
    expect(screen.getByTestId("es").className).toContain("extra");
  });

  it("sizes by padding", () => {
    const { rerender } = render(<EmptyState title="x" data-testid="es" size="page" />);
    expect(screen.getByTestId("es").className).toContain("py-16");
    rerender(<EmptyState title="x" data-testid="es" />);
    expect(screen.getByTestId("es").className).toContain("py-10");
    rerender(<EmptyState title="x" data-testid="es" size="inline" />);
    expect(screen.getByTestId("es").className).toContain("py-8");
  });
});
