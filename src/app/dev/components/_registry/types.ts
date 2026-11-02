import type { DocMeta } from "@/app/dev/_shell/types";

/** Index and sidebar categories, in order. */
export const CATEGORIES = [
  "Actions",
  "Forms",
  "Overlays",
  "Navigation",
  "Data display",
  "Feedback",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_BLURBS: Record<Category, string> = {
  Actions: "Things people press.",
  Forms: "Fields and controls for entering and choosing.",
  Overlays: "Content that opens above the page.",
  Navigation: "Moving between pages and within one.",
  "Data display": "Showing records, people, events and status.",
  Feedback: "Telling people what happened, or that nothing is there.",
};

export const APP_COMPONENTS = {
  id: "app-components",
  title: "App components",
  badge: "Not in the package",
  blurb:
    "Built from the components above but tied to UX Hub’s auth, payments or event data. They stay in the app when the library is extracted.",
} as const;

/**
 * - `primitive`: a `src/components/ui` module.
 * - `composite`: a shared assembly from `src/components/shared`.
 * - `app`: tied to UX Hub's data; listed under App components, not its
 *   category, and left behind when the library is extracted.
 */
export type Tier = "primitive" | "composite" | "app";

/** An old `?section=` id that now points at an entry, at an optional anchor. */
export interface Alias {
  id: string;
  hash?: string;
}

/** One page under `/dev/components/<slug>`. */
export interface RegistryEntry extends DocMeta {
  /** kebab-case, the URL segment. Never rename: links point at it; add an alias instead. */
  slug: string;
  /** Where a reader would look for it, not where its code lives. */
  category: Category;
  tier: Tier;
  /**
   * Old ids that redirect here, for when an entry is split out of, or renamed
   * from, another. `/dev/components?section=<id>` lands on this page (at
   * `#hash` when given).
   */
  aliases?: readonly Alias[];
}
