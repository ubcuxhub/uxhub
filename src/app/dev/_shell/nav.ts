import { FLAGS } from "@/lib/flags";

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

/**
 * Pages built on fixture data that include the unlaunched student-events
 * screens. They follow `FLAGS.studentEvents`: shown on local and preview
 * deploys, a 404 in production (`showUnlaunchedPages`).
 */
const UNLAUNCHED_PAGES = new Set(["/dev/gallery", "/dev/templates"]);

/** Whether the gallery and templates are served on this deploy. */
export const showUnlaunchedPages = FLAGS.studentEvents;

/** Whether the docs page at `href` is served here (not an unlaunched one in production). */
export function isServedPage(href: string) {
  return showUnlaunchedPages || !UNLAUNCHED_PAGES.has(href);
}

/** Pages listed above the categories, in order. Searchable like entries. */
const ALL_TOP_LINKS: readonly NavEntry[] = [
  { href: INDEX_PATH, title: "Components", keywords: ["index", "all", "library"] },
  {
    href: "/dev/foundations",
    title: "Foundations",
    keywords: [
      "colour",
      "color",
      "type",
      "typography",
      "radius",
      "tokens",
      "icons",
      "elevation",
      "motion",
      "density",
      "focus",
    ],
  },
  {
    href: "/dev/gallery",
    title: "Gallery",
    keywords: ["compositions", "canvas", "examples", "showcase"],
  },
  {
    href: "/dev/templates",
    title: "Templates",
    keywords: ["events", "event detail", "event builder", "applications", "application review", "reviewer notes", "pages", "layouts"],
  },
];

export const TOP_LINKS: readonly NavEntry[] = ALL_TOP_LINKS.filter((link) =>
  isServedPage(link.href),
);

/** Whether the sidebar search `query` finds `entry`. An empty query finds everything. */
export function matches(entry: NavEntry, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.title, ...entry.keywords].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

/**
 * What the sidebar shows for `query`: the top links and groups that match
 * (a group with no matching entry is dropped), and how many links that is.
 */
export function filterNav(
  topLinks: readonly NavEntry[],
  groups: readonly NavGroup[],
  query: string,
) {
  const tops = topLinks.filter((link) => matches(link, query));
  const shown = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => matches(entry, query)),
    }))
    .filter((group) => group.entries.length > 0);
  const count =
    tops.length + shown.reduce((sum, group) => sum + group.entries.length, 0);
  return { topLinks: tops, groups: shown, count };
}
