// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TabNav, TabNavLink } from "./tab-nav";

afterEach(cleanup);

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
});
