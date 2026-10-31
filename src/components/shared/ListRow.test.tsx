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

  // jsdom has no layout, so these pin the classes that keep the row inside a
  // 375px card; the overflow itself was checked in the browser (gallery,
  // /dev/components?section=lists, at 375px).
  it("uses a bounded text track and no fixed-width wrapping link", () => {
    render(
      <ul>
        <ListRow
          name="Alexandria Montgomery-Featherstonehaugh"
          description="Senior staff product designer and design systems lead · Northwind Traders International"
          lead={{ kind: "person" }}
          link={{ href: "https://example.com", label: "LinkedIn" }}
        />
      </ul>,
    );

    const row = screen.getByRole("listitem");
    expect(row.className).toContain("grid-cols-[4rem_minmax(0,1fr)]");
    expect(row.className).toContain("sm:grid-cols-[4rem_minmax(0,1fr)_auto]");
    expect(row.className).not.toContain("flex-wrap");

    const link = screen.getByRole("link");
    expect(link.className).not.toContain("basis-full");
    expect(link.className).not.toContain("ml-20");
    expect(link.className).toContain("col-start-2");
  });

  it("keeps two columns when there is no link", () => {
    render(
      <ul>
        <ListRow name="Alex Chen" lead={{ kind: "person" }} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("grid-cols-[4rem_minmax(0,1fr)]");
    expect(row.className).not.toContain("_auto]");
  });
});
