// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ListCard, ListRow } from "./ListRow";

afterEach(cleanup);

describe("ListCard", () => {
  it("names the section and contains its rows in a list", () => {
    render(
      <ListCard title="Judges" summary="Three industry reviewers">
        <ListRow name="Alex Chen" lead={{ kind: "person" }} />
      </ListCard>,
    );

    expect(screen.getByRole("region", { name: "Judges" })).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toContain("Alex Chen");
  });
});

describe("ListRow", () => {
  it("labels an external link with the person's name", () => {
    render(
      <ul>
        <ListRow
          name="Alex Chen"
          description="Product designer"
          lead={{ kind: "person", src: "/people/david.jpg" }}
          link={{ href: "https://example.com/alex", label: "LinkedIn" }}
        />
      </ul>,
    );

    const link = screen.getByRole("link", { name: "Alex Chen on LinkedIn" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("falls back to organization initials", () => {
    render(
      <ul>
        <ListRow
          name="Northwind Studio"
          description="Community partner"
          lead={{ kind: "organization" }}
        />
      </ul>,
    );

    expect(screen.getByText("NS").getAttribute("aria-hidden")).not.toBeNull();
  });
});
