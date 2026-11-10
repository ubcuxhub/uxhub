import { describe, expect, it } from "vitest";

import { ENTRIES } from "@/app/dev/components/_registry";

import { MANIFEST as COMPOSITIONS } from "./manifest";
import { COLUMNS } from "./types";

// Reads the manifest only: the components import app modules (the user
// context, server actions) that don't load outside Next.
const columnOf = (column: number) =>
  COMPOSITIONS.filter((composition) => composition.column === column);

/**
 * Registry entries the gallery leaves out on purpose. Each needs a reason;
 * everything else must appear in at least one composition's `uses`.
 */
const NOT_IN_GALLERY: readonly string[] = [
  // Lives on the auth screens, which are outside the portal the gallery
  // composes; no portal screen asks for a password.
  "password-input",
];

const SLUGS = new Set(ENTRIES.map((entry) => entry.slug));

describe("gallery compositions", () => {
  it("has unique ids", () => {
    const ids = COMPOSITIONS.map((composition) => composition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only names registry slugs in `uses`", () => {
    for (const composition of COMPOSITIONS) {
      for (const slug of composition.uses as readonly string[]) {
        expect(SLUGS.has(slug), `${composition.id} uses unknown "${slug}"`).toBe(true);
      }
      expect(new Set(composition.uses).size, composition.id).toBe(composition.uses.length);
    }
  });

  it("uses every registry entry that isn't excluded", () => {
    const used = new Set<string>(COMPOSITIONS.flatMap((composition) => composition.uses));
    const missing = [...SLUGS].filter(
      (slug) => !used.has(slug) && !NOT_IN_GALLERY.includes(slug),
    );
    expect(missing).toEqual([]);
  });

  it("only excludes real slugs that no composition uses", () => {
    const used = new Set<string>(COMPOSITIONS.flatMap((composition) => composition.uses));
    for (const slug of NOT_IN_GALLERY) {
      expect(SLUGS.has(slug), slug).toBe(true);
      expect(used.has(slug), slug).toBe(false);
    }
  });

  it("fills every column with enough to scroll", () => {
    for (const column of COLUMNS) {
      expect(columnOf(column).length, `column ${column}`).toBeGreaterThanOrEqual(4);
    }
    expect(COMPOSITIONS.length).toBeGreaterThanOrEqual(25);
  });
});
