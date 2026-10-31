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

  it("renders an icon in its own disc", () => {
    const { container } = render(
      <EmptyState title="No events" icon={<Calendar />} />,
    );
    expect(container.querySelector("[data-slot=empty-state-icon] svg")).toBeTruthy();
    expect(container.querySelector("[data-slot=empty-state-media]")).toBeNull();
  });

  it("renders media unframed, above the title", () => {
    const { container } = render(
      <EmptyState
        title="No events"
        media={<span data-testid="art" />}
      />,
    );
    const media = container.querySelector("[data-slot=empty-state-media]");
    expect(media?.contains(screen.getByTestId("art"))).toBe(true);
    // No 40px disc around art.
    expect(media?.className).not.toContain("size-10");
    expect(container.querySelector("[data-slot=empty-state-icon]")).toBeNull();
    const title = screen.getByRole("heading", { name: "No events" });
    expect(
      media!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("media wins when both media and icon are given", () => {
    const { container } = render(
      <EmptyState
        title="No events"
        icon={<Calendar />}
        media={<span data-testid="art" />}
      />,
    );
    expect(screen.getByTestId("art")).toBeTruthy();
    expect(container.querySelector("[data-slot=empty-state-icon]")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("drops the icon at inline size too", () => {
    const { container } = render(
      <EmptyState size="inline" title="No events" icon={<Calendar />} />,
    );
    expect(container.querySelector("[data-slot=empty-state-icon]")).toBeNull();
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
