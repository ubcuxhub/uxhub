// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TabNav, TabNavLink } from "./tab-nav";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BASE = "/admin/events/abc";

function Example({ pathname }: { pathname: string }) {
  return (
    <TabNav aria-label="Event pages" pathname={pathname}>
      <TabNavLink href={BASE} exact>
        Overview
      </TabNavLink>
      <TabNavLink href={`${BASE}/review-applications`} count={12}>
        Applications
      </TabNavLink>
      <TabNavLink href={`${BASE}/check-in`}>Check-in</TabNavLink>
    </TabNav>
  );
}

function current() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
}

describe("TabNav", () => {
  it("is a labelled navigation landmark of links, not a tablist", () => {
    render(<Example pathname={BASE} />);

    expect(screen.getByRole("navigation", { name: "Event pages" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("marks exactly one link as the current page", () => {
    for (const [pathname, name] of [
      [BASE, "Overview"],
      [`${BASE}/review-applications`, "Applications 12"],
      [`${BASE}/check-in`, "Check-in"],
    ] as const) {
      const { unmount } = render(<Example pathname={pathname} />);
      const links = current();
      expect(links).toHaveLength(1);
      expect(links[0]).toBe(screen.getByRole("link", { name }));
      unmount();
    }
  });

  it("matches an exact link only on its own path", () => {
    render(<Example pathname={`${BASE}/check-in`} />);

    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("matches a prefix link on its own path and on paths below it", () => {
    const { unmount } = render(<Example pathname={`${BASE}/review-applications`} />);
    expect(current()[0]?.textContent).toContain("Applications");
    unmount();

    render(<Example pathname={`${BASE}/review-applications/42`} />);
    expect(current()).toHaveLength(1);
    expect(current()[0]?.textContent).toContain("Applications");
  });

  it("does not treat a sibling that shares a prefix as a child", () => {
    render(
      <TabNav aria-label="Sections" pathname="/admin/events-archive">
        <TabNavLink href="/admin/events">Events</TabNavLink>
      </TabNav>,
    );

    expect(current()).toHaveLength(0);
  });

  it("ignores query, hash and a trailing slash when matching", () => {
    render(
      <TabNav aria-label="Sections" pathname="/admin/users/">
        <TabNavLink href="/admin/users?role=admin" exact>
          Users
        </TabNavLink>
      </TabNav>,
    );

    expect(current()).toHaveLength(1);
  });

  it("includes the count in the link's accessible name", () => {
    render(<Example pathname={BASE} />);

    const link = screen.getByRole("link", { name: "Applications 12" });
    expect(link.querySelector("[data-slot=tab-nav-link-count]")?.textContent).toBe("12");
  });

  it("has no current page when no link matches", () => {
    render(<Example pathname="/portal" />);

    expect(current()).toHaveLength(0);
  });

  describe("keeping the current link in view", () => {
    // jsdom has no layout, so give the row a 100px viewport and the current
    // link (the last one, 200-260px) a position outside it.
    function mockLayout(overflows: boolean) {
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "UL" ? (overflows ? 300 : 100) : 0;
        },
      );
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "UL" ? 100 : 0;
        },
      );
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const box =
            this.tagName === "UL"
              ? { left: 0, right: 100 }
              : { left: 200, right: 260 };
          return { ...box, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} };
        },
      );
    }

    it("scrolls only the row sideways, never the window or an ancestor", () => {
      mockLayout(true);
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(<Example pathname={`${BASE}/check-in`} />);

      const row = screen.getByRole("navigation").querySelector("ul")!;
      expect(row.scrollLeft).toBe(160);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollIntoView).not.toHaveBeenCalled();
      // @ts-expect-error restore the jsdom default (the method is undefined there)
      delete Element.prototype.scrollIntoView;
    });

    it("leaves the row alone when it does not overflow", () => {
      mockLayout(false);

      render(<Example pathname={`${BASE}/check-in`} />);

      const row = screen.getByRole("navigation").querySelector("ul")!;
      expect(row.scrollLeft).toBe(0);
    });
  });
});
