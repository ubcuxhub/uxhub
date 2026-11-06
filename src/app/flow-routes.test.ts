import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Rules for the `@flow` parallel slot, which holds intercepted routes: the
 * membership dialog under `(.)portal/*` and the admin record drawers under
 * `(.)admin/*`.
 *
 * 1. Every intercepted page has a canonical twin under `(app)/(shell)`, so a
 *    refresh or a shared link of the same URL works. (Not every canonical page
 *    has a drawer: `/edit`, `/check-in` and `create-new` are pages only.)
 * 2. `@flow` renders beside `(app)`, not inside it, so the `(app)` and
 *    `admin` layouts' guards never run for it. Every layout and page under
 *    `(.)admin` must call `requireAdmin()` itself, or render a route
 *    component that does. Layouts and pages render in parallel, so a guard in
 *    the layout doesn't stop the page from fetching.
 */

const APP = path.join("src", "app");
const FLOW = path.join(APP, "@flow");
const CANONICAL = path.join(APP, "(app)", "(shell)");
const SRC = "src";

/** Route files that render, and so may fetch, for a request. */
const RENDERING_FILE = /^(layout|page|template|default)\.tsx?$/;
const GUARD_CALL = /\brequireAdmin\s*\(/;

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

const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** Resolves an `@/…` or relative import from `fromFile` to a source file. */
function resolveImport(specifier: string, fromFile: string) {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.join(path.dirname(fromFile), specifier);
  else return null;
  for (const extension of ["", ...EXTENSIONS]) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

/**
 * Whether `file` calls `requireAdmin()`, directly or in a module it imports
 * (the route component it renders). One level deep: the route component is
 * where the guard belongs.
 */
function guardsAdmin(file: string) {
  const source = readFileSync(file, "utf8");
  if (GUARD_CALL.test(source)) return true;
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
  return imports.some((specifier) => {
    const resolved = resolveImport(specifier, file);
    return resolved !== null && GUARD_CALL.test(readFileSync(resolved, "utf8"));
  });
}

describe("@flow intercepted routes", () => {
  const pages = interceptedFiles().filter((file) => /(^|\/)page\.tsx?$/.test(file));

  it("finds the intercepted pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("gives every intercepted page a canonical twin under (app)/(shell)", () => {
    const missing = pages.filter((page) => !existsSync(path.join(CANONICAL, canonicalPath(page))));
    expect(missing).toEqual([]);
  });

  it("guards every (.)admin layout and page with requireAdmin()", () => {
    const admin = interceptedFiles().filter(
      (file) => file.startsWith("(.)admin/") && RENDERING_FILE.test(path.posix.basename(file)),
    );
    const unguarded = admin.filter((file) => !guardsAdmin(path.join(FLOW, file)));
    expect(unguarded).toEqual([]);
  });
});

describe("guardsAdmin", () => {
  it("sees a direct call", () => {
    expect(guardsAdmin(path.join(APP, "(app)", "(shell)", "admin", "layout.tsx"))).toBe(true);
  });

  it("finds none in a route that has none", () => {
    expect(guardsAdmin(path.join(FLOW, "(.)portal", "membership", "page.tsx"))).toBe(false);
  });

  it("follows the route component a page renders", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "flow-routes-"));
    try {
      writeFileSync(
        path.join(dir, "Route.tsx"),
        `export async function Route() { await requireAdmin(); return null; }`,
      );
      writeFileSync(path.join(dir, "page.tsx"), `import { Route } from "./Route";\nexport default Route;`);
      writeFileSync(path.join(dir, "bare.tsx"), `import { x } from "./missing";\nexport default x;`);
      expect(guardsAdmin(path.join(dir, "page.tsx"))).toBe(true);
      expect(guardsAdmin(path.join(dir, "bare.tsx"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
