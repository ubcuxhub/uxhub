import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Rules for the `@flow` parallel slot, which holds intercepted routes (the
 * membership and checkout dialogs under `(.)portal/*`), and for the admin
 * record drawers, which don't use it.
 *
 * 1. Every intercepted page has a canonical twin under `(app)/(shell)`, so a
 *    refresh or a shared link of the same URL works.
 * 2. Admin records are nested routes, not intercepted ones: each list is a
 *    layout that renders `RecordFrame` around its `children`, and each record
 *    is a child route, so the drawer sits under the `(app)` and admin layouts
 *    (and their guards and `UserProvider`), on a soft navigation and a refresh
 *    alike. `@flow` renders beside `(app)`, where none of that applies.
 */

const APP = path.join("src", "app");
const FLOW = path.join(APP, "@flow");
const CANONICAL = path.join(APP, "(app)", "(shell)");
const ADMIN = path.join(CANONICAL, "admin");

/** Files under `dir`, relative to it, with `/` separators. */
function filesUnder(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
}

/** Intercepted route files: paths under `@flow` whose first segment is an interception marker. */
function interceptedFiles() {
  return filesUnder(FLOW).filter((file) => /^\(\.{1,3}\)/.test(file));
}

/** `(.)portal/membership/page.tsx` → `portal/membership/page.tsx`. */
function canonicalPath(intercepted: string) {
  return intercepted.replace(/^\(\.{1,3}\)/, "");
}

const read = (...segments: string[]) => readFileSync(path.join(ADMIN, ...segments), "utf8");

describe("@flow intercepted routes", () => {
  const pages = interceptedFiles().filter((file) => /(^|\/)page\.tsx?$/.test(file));

  it("finds the intercepted pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("gives every intercepted page a canonical twin under (app)/(shell)", () => {
    const missing = pages.filter((page) => !existsSync(path.join(CANONICAL, canonicalPath(page))));
    expect(missing).toEqual([]);
  });

  it("intercepts no admin route", () => {
    expect(interceptedFiles().filter((file) => file.startsWith("(.)admin/"))).toEqual([]);
  });
});

describe("admin record routes", () => {
  it("renders each list as a layout with its records' drawer", () => {
    expect(read("users", "layout.tsx")).toMatch(/<RecordFrame listHref="\/admin\/users">\{children\}<\/RecordFrame>/);
    expect(read("events", "(browse)", "layout.tsx")).toMatch(
      /<RecordFrame listHref="\/admin\/events">\{children\}<\/RecordFrame>/,
    );
  });

  it("serves each record as a child route of its list", () => {
    expect(existsSync(path.join(ADMIN, "users", "[userId]", "page.tsx"))).toBe(true);
    expect(existsSync(path.join(ADMIN, "events", "(browse)", "[event]", "page.tsx"))).toBe(true);
  });

  it("keeps the event builder and the event's other pages outside the list", () => {
    for (const page of [
      "[event]/edit",
      "[event]/(manager)/overview",
      "[event]/(manager)/check-in",
      "[event]/(manager)/agenda",
      "[event]/(manager)/teams",
      "[event]/(manager)/review-applications",
      "create-new",
    ]) {
      expect(existsSync(path.join(ADMIN, "events", page, "page.tsx"))).toBe(true);
    }
    expect(existsSync(path.join(ADMIN, "events", "layout.tsx"))).toBe(false);
  });

  it("wraps the event manager's tabs in its layout, but not the builder", () => {
    expect(existsSync(path.join(ADMIN, "events", "[event]", "(manager)", "layout.tsx"))).toBe(true);
    // A layout at `[event]` would wrap the builder too.
    expect(existsSync(path.join(ADMIN, "events", "[event]", "layout.tsx"))).toBe(false);
    expect(existsSync(path.join(ADMIN, "events", "[event]", "(manager)", "edit"))).toBe(false);
  });

  it("keeps every event page's URL: route groups don't change them", () => {
    // `(shell)/admin/events/[event]/(manager)/check-in/page.tsx` → `/admin/events/[event]/check-in`.
    const urls = filesUnder(path.join(APP, "(app)"))
      .filter((file) => /(^|\/)page\.tsx$/.test(file))
      .map((file) => `/${file.split("/").slice(0, -1).filter((segment) => !/^\(.+\)$/.test(segment)).join("/")}`);
    for (const url of [
      "/admin/events/[event]",
      "/admin/events/[event]/overview",
      "/admin/events/[event]/edit",
      "/admin/events/[event]/agenda",
      "/admin/events/[event]/check-in",
      "/admin/events/[event]/check-in/scan",
      "/admin/events/[event]/teams",
      "/admin/events/[event]/review-applications",
      "/admin/events/[event]/review-applications/[applicationId]",
    ]) {
      expect(urls.filter((candidate) => candidate === url), url).toHaveLength(1);
    }
  });

  it("links Create Event with a soft navigation", () => {
    const layout = read("events", "(browse)", "layout.tsx");
    expect(layout).toContain("<Link href={CREATE_EVENT_HREF}>");
    expect(layout).not.toContain("<a href={CREATE_EVENT_HREF}>");
  });
});
