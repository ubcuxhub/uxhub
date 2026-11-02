/** A sidebar link to one component page. */
export interface NavEntry {
  href: string;
  title: string;
  /** Other text the sidebar search matches (slug, category, description, exports). */
  keywords: readonly string[];
}

/** A sidebar group: a category, or App components. */
export interface NavGroup {
  id: string;
  title: string;
  entries: readonly NavEntry[];
}

export const INDEX_PATH = "/dev/components";

/** Pages listed above the categories, in order. */
export const TOP_LINKS = [
  { href: INDEX_PATH, title: "Components" },
  { href: "/dev/foundations", title: "Foundations" },
  { href: "/dev/templates", title: "Templates" },
] as const;
