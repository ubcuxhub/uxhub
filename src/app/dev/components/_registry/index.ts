import type { NavGroup } from "@/app/dev/_shell/nav";

import { dataEntries } from "./data";
import { formsEntries } from "./forms";
import { interactionEntries } from "./interaction";
import {
  APP_COMPONENTS,
  CATEGORIES,
  CATEGORY_BLURBS,
  type Category,
  type RegistryEntry,
} from "./types";

export type { Alias, Category, RegistryEntry, Tier } from "./types";

/**
 * Every component page. Data only, so the server pages, the index and the
 * sidebar can read it without reaching a demo: the demos are imported by the
 * loaders in `demos.ts`, which only `/dev/components/<slug>` uses. Add
 * entries to a shard, never here.
 */
export const ENTRIES: readonly RegistryEntry[] = [
  ...formsEntries,
  ...dataEntries,
  ...interactionEntries,
];

export interface EntryGroup {
  /** Anchor on the index: "data-display", "app-components". */
  id: string;
  title: string;
  blurb: string;
  /** App components get their own block and are left out of the library. */
  app: boolean;
  /** Alphabetical by title, so shards never fight over order. */
  entries: readonly RegistryEntry[];
}

function anchor(category: Category) {
  return category.toLowerCase().replace(/\s+/g, "-");
}

const byTitle = (a: RegistryEntry, b: RegistryEntry) =>
  a.title.localeCompare(b.title, "en");

/** Index and sidebar groups, in order: the categories, then App components. */
export const ENTRY_GROUPS: readonly EntryGroup[] = [
  ...CATEGORIES.map((category) => ({
    id: anchor(category),
    title: category,
    blurb: CATEGORY_BLURBS[category],
    app: false,
    entries: ENTRIES.filter(
      (entry) => entry.tier !== "app" && entry.category === category,
    ).sort(byTitle),
  })),
  {
    id: APP_COMPONENTS.id,
    title: APP_COMPONENTS.title,
    blurb: APP_COMPONENTS.blurb,
    app: true,
    entries: ENTRIES.filter((entry) => entry.tier === "app").sort(byTitle),
  },
].filter((group) => group.entries.length > 0);

/** Sidebar order, for previous and next. */
export const ORDERED: readonly RegistryEntry[] = ENTRY_GROUPS.flatMap(
  (group) => group.entries,
);

export function entryBySlug(slug: string): RegistryEntry | undefined {
  return ENTRIES.find((entry) => entry.slug === slug);
}

/** The group an entry is listed under. */
export function groupOf(entry: RegistryEntry): EntryGroup {
  return ENTRY_GROUPS.find((group) => group.entries.includes(entry))!;
}

export function entryPath(slug: string) {
  return `/dev/components/${slug}`;
}

/** The sidebar's copy of the groups: plain data a client component can take. */
export function navGroups(): NavGroup[] {
  return ENTRY_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    entries: group.entries.map((entry) => ({
      href: entryPath(entry.slug),
      title: entry.title,
      keywords: [
        entry.slug,
        entry.category,
        entry.description,
        ...(entry.importNames ?? []),
      ],
    })),
  }));
}
