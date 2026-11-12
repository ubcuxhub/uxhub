import { describe, expect, it } from "vitest";

import { filterNav, TOP_LINKS, type NavGroup } from "./nav";

const GROUPS: NavGroup[] = [
  {
    id: "actions",
    title: "Actions",
    entries: [
      { href: "/dev/components/button", title: "Buttons", keywords: ["button", "Button"] },
      { href: "/dev/components/spinner", title: "Spinner", keywords: ["spinner", "loading"] },
    ],
  },
  {
    id: "forms",
    title: "Forms",
    entries: [{ href: "/dev/components/input", title: "Input", keywords: ["input"] }],
  },
];

const titles = (result: ReturnType<typeof filterNav>) => ({
  top: result.topLinks.map((link) => link.title),
  entries: result.groups.flatMap((group) => group.entries.map((entry) => entry.title)),
});

describe("filterNav", () => {
  it("shows everything for an empty query", () => {
    const result = filterNav(TOP_LINKS, GROUPS, "  ");
    expect(result.topLinks).toHaveLength(TOP_LINKS.length);
    expect(result.count).toBe(TOP_LINKS.length + 3);
  });

  it("matches top links by title and keyword", () => {
    expect(titles(filterNav(TOP_LINKS, GROUPS, "tokens")).top).toEqual(["Foundations"]);
    expect(titles(filterNav(TOP_LINKS, GROUPS, "canvas")).top).toEqual(["Gallery"]);
    expect(titles(filterNav(TOP_LINKS, GROUPS, "event builder")).top).toEqual(["Templates"]);
    expect(titles(filterNav(TOP_LINKS, GROUPS, "GALL")).top).toEqual(["Gallery"]);
  });

  it("hides top links and groups that don't match, and counts both", () => {
    const result = filterNav(TOP_LINKS, GROUPS, "loading");
    expect(titles(result)).toEqual({ top: [], entries: ["Spinner"] });
    expect(result.groups.map((group) => group.id)).toEqual(["actions"]);
    expect(result.count).toBe(1);

    const both = filterNav(TOP_LINKS, GROUPS, "in");
    expect(both.count).toBe(both.topLinks.length + 2);
    expect(titles(both).entries).toEqual(["Spinner", "Input"]);
  });

  it("finds nothing for a query nothing matches", () => {
    const result = filterNav(TOP_LINKS, GROUPS, "zzz");
    expect(result).toEqual({ topLinks: [], groups: [], count: 0 });
  });
});
