import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { STANDALONE } from "@/app/dev/_shell/standalone";

import { dataEntries } from "./data";
import { DEMO_LOADERS } from "./demos";
import { ENTRIES, ENTRY_GROUPS, ORDERED } from "./index";
import { legacyRedirect, resolveSection } from "./resolve";

/** Every `?section=` id the single-page gallery had. Old links use them. */
const LEGACY_IDS = [
  "foundations",
  "buttons",
  "form-controls",
  "surfaces",
  "overlays",
  "navigation",
  "composites",
  "feedback",
  "choice-controls",
  "tabs-and-menus",
  "people",
  "data-table",
  "field-extensions",
  "date-time",
  "colour-picker",
  "events",
  "media",
  "admin-data",
  "searchable-dropdown",
  "side-peek-drawer",
  "section-navigator",
  "lists",
  "ticket",
  "route-tabs",
  "templates",
];

describe("resolveSection", () => {
  it("resolves every legacy id to a page", () => {
    for (const id of LEGACY_IDS) {
      expect(resolveSection(id), id).toBeDefined();
    }
  });

  it("sends component ids to their component page", () => {
    expect(resolveSection("buttons")).toBe("/dev/components/buttons");
    expect(resolveSection("side-peek-drawer")).toBe(
      "/dev/components/side-peek-drawer",
    );
  });

  it("sends foundations and templates to their own pages", () => {
    expect(resolveSection("foundations")).toBe("/dev/foundations");
    expect(resolveSection("templates")).toBe("/dev/templates");
  });

  it("returns undefined for an unknown id", () => {
    expect(resolveSection("nope")).toBeUndefined();
  });
});

describe("legacyRedirect", () => {
  it("does nothing without a section", () => {
    expect(legacyRedirect({})).toBeUndefined();
    expect(legacyRedirect({ theme: "dark" })).toBeUndefined();
    expect(legacyRedirect(new URLSearchParams("section="))).toBeUndefined();
  });

  it("returns null for an unknown section", () => {
    expect(legacyRedirect({ section: "nope" })).toBeNull();
  });

  it("keeps theme, density and open", () => {
    expect(
      legacyRedirect({
        section: "overlays",
        theme: "split",
        density: "compact",
        open: "dialog",
      }),
    ).toBe("/dev/components/overlays?theme=split&density=compact&open=dialog");
    expect(
      legacyRedirect(new URLSearchParams("section=templates&open=events-frame&theme=dark")),
    ).toBe("/dev/templates?theme=dark&open=events-frame");
  });

  it("drops invalid and unrelated params, as the pages do", () => {
    expect(
      legacyRedirect({ section: "buttons", theme: "sepia", density: "cosy", x: "1" }),
    ).toBe("/dev/components/buttons");
  });

  it("takes the first value of a repeated param", () => {
    expect(
      legacyRedirect({ section: ["foundations", "templates"], theme: ["dark", "light"] }),
    ).toBe("/dev/foundations?theme=dark");
  });
});

describe("aliases", () => {
  it("redirect to the entry that claims them, at its anchor", async () => {
    const withAlias = await importWithAlias({ id: "old-id", hash: "part" });
    expect(withAlias.resolveSection("old-id")).toBe(
      `/dev/components/${ALIAS_TARGET}#part`,
    );
    expect(
      withAlias.legacyRedirect({ section: "old-id", theme: "dark" }),
    ).toBe(`/dev/components/${ALIAS_TARGET}?theme=dark#part`);

    const bare = await importWithAlias({ id: "old-bare" });
    expect(bare.resolveSection("old-bare")).toBe(`/dev/components/${ALIAS_TARGET}`);
  });
});

describe("registry", () => {
  const slugs = ENTRIES.map((entry) => entry.slug);
  const aliases = ENTRIES.flatMap((entry) => entry.aliases ?? []).map((a) => a.id);

  it("has unique kebab-case slugs", () => {
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has aliases that name no other page", () => {
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const id of aliases) {
      expect(slugs, id).not.toContain(id);
      expect(Object.keys(STANDALONE), id).not.toContain(id);
    }
  });

  it("has no slug that shadows a standalone page", () => {
    for (const id of Object.keys(STANDALONE)) expect(slugs).not.toContain(id);
  });

  it("lists every entry once, app components only in their own group", () => {
    expect(ORDERED.length).toBe(ENTRIES.length);
    for (const group of ENTRY_GROUPS) {
      for (const entry of group.entries) {
        expect(entry.tier === "app", entry.slug).toBe(group.app);
      }
    }
  });

  it("sorts each group by title", () => {
    for (const group of ENTRY_GROUPS) {
      const titles = group.entries.map((entry) => entry.title);
      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "en")));
    }
  });

  it("has exactly one demo loader per entry", () => {
    expect(Object.keys(DEMO_LOADERS).sort()).toEqual([...slugs].sort());
  });

  it("points `source` at files that exist", () => {
    for (const entry of ENTRIES) {
      if (entry.source) expect(existsSync(entry.source), entry.source).toBe(true);
    }
  });
});

// --- Helpers ------------------------------------------------------------------

/** The `data` shard entry the alias tests attach to, so renames there don't break them. */
const ALIAS_TARGET = dataEntries[0].slug;

/** The registry with one test alias added to `ALIAS_TARGET`. */
async function importWithAlias(alias: { id: string; hash?: string }) {
  vi.resetModules();
  vi.doMock("./data", async (importOriginal) => {
    const original = await importOriginal<typeof import("./data")>();
    return {
      dataEntries: original.dataEntries.map((entry) =>
        entry.slug === ALIAS_TARGET ? { ...entry, aliases: [alias] } : entry,
      ),
    };
  });
  const mod = await import("./resolve");
  vi.doUnmock("./data");
  return mod;
}
