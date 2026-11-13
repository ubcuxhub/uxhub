import { readdirSync } from "node:fs";
import path from "node:path";
import { normalizeCatchAllRoutes } from "next/dist/build/normalize-catchall-routes";
import { normalizeAppPath, selectAppPageEntry } from "next/dist/shared/lib/router/utils/app-paths";
import { describe, expect, it, vi } from "vitest";
import DefaultPage from "./default";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
}));

// Exercise the installed Next route matcher against the real file tree. Source
// shape checks alone missed the handler/catch-all conflict on framework upgrade.
const entries = readdirSync("src/app", { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /^(page|route|default)\.(tsx?|jsx?)$/.test(entry.name))
  .map((entry) => "/" + path.relative("src/app", path.join(entry.parentPath, entry.name))
    .split(path.sep).join("/").replace(/\.(tsx?|jsx?)$/, ""));
const defaults = entries.filter((entry) => entry.endsWith("/default"));

function matchRoutes(defaultAppPaths = defaults) {
  const routes: Record<string, string[]> = {};
  for (const entry of entries.filter((entry) => !entry.endsWith("/default"))) {
    (routes[normalizeAppPath(entry)] ??= []).push(entry);
  }
  const result = normalizeCatchAllRoutes(routes, { strictRouteMatching: true, defaultAppPaths });
  return { ...result, routes };
}

const handlers = [
  "/api/admin/users/[userId]/photo",
  "/api/internal/event-publication",
  "/api/profile-photo",
  "/api/square/webhook",
  "/api/upload-event-image",
  "/auth/callback",
];

describe("strict root parallel-slot coverage", () => {
  it("reproduces the six handler conflicts without the children fallback", () => {
    const result = matchRoutes(defaults.filter((entry) => entry !== "/default"));
    expect(result.incompatibleParallelRouteSlots.map((entry) => entry.route).sort()).toEqual(handlers.toSorted());
  });

  it("renders all discovered pages with strict route matching", () => {
    const result = matchRoutes();
    expect(result.incompatibleParallelRouteSlots).toEqual([]);
    expect(result.unmatchedAppPages).toEqual([]);
  });

  it.each(handlers)("keeps %s owned by its handler", (route) => {
    const { routes } = matchRoutes();
    expect(selectAppPageEntry(route, routes[route])).toMatch(/\/route$/);
  });

  it.each([
    "/portal/events/[event]/checkout",
    "/portal/membership",
    "/portal/membership/join",
    "/portal/membership/join/[audience]",
    "/portal/membership/[membership]/checkout",
    "/admin/events/[event]",
    "/admin/users/[userId]",
  ])("keeps direct navigation to %s on its canonical page", (route) => {
    const { routes } = matchRoutes();
    expect(selectAppPageEntry(route, routes[route])).toMatch(/^\/\(app\)\/\(shell\)\//);
  });

  it("returns not-found when the main slot has no page", () => {
    expect(() => DefaultPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
