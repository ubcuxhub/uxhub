import type { ComponentType } from "react";

/**
 * Props every gallery section receives.
 *
 * A "split" section can be rendered twice (light and dark columns, "Side by
 * side") at the same time, so ids and `htmlFor` pairs inside it must come
 * from `useId()`, never a literal.
 */
export interface SectionProps {
  /** Value of `?open=`, for forcing one overlay open. */
  open?: string;
}

/**
 * Sidebar groups, in sidebar order. Put a section where a reader would look
 * for it, not where its code lives.
 */
export const GALLERY_GROUPS = [
  "Foundations",
  "Actions",
  "Forms",
  "Overlays",
  "Navigation",
  "Data display",
  "Feedback",
  "Composites",
  "Templates",
] as const;

export type GalleryGroup = (typeof GALLERY_GROUPS)[number];

export interface GallerySection {
  /** kebab-case. Used by `?section=<id>` and as the `#<id>` anchor. Never rename: links point at it. */
  id: string;
  /** "Buttons" */
  title: string;
  /** Sidebar group the section is listed under. */
  group: GalleryGroup;
  /** One line on when to reach for it, shown under the title and on the overview. */
  description: string;
  /**
   * The module to import from, when the section documents one module
   * ("@/components/ui/button"). Shown as a copyable import line.
   */
  importPath?: string;
  /** Names the import line pulls from `importPath` ("Button", "IconButton"). */
  importNames?: readonly string[];
  /** Design-system reference, "§3.1". */
  spec: string;
  /**
   * "split": rendered twice, light | dark columns, when Side by side is on.
   * "page": rendered once, in the page theme (portaled overlays, full-width
   * compositions).
   *
   * A "split" section that is given an `open` state it lists in `openStates`
   * is rendered once as "page" instead: portaled content ignores a column's
   * theme, so those are checked with `theme=light` and `theme=dark`.
   */
  layout: "split" | "page";
  /** `?open=` values this section understands, listed as links on its page. */
  openStates?: readonly string[];
  Component: ComponentType<SectionProps>;
}

/** Parsed query parameters, handled only in `Gallery.tsx`. */
export interface GalleryParams {
  /**
   * `light`/`dark` set the page theme; `split` ("Side by side", wide screens
   * only) shows light and dark columns. Unset follows the viewer's own theme.
   */
  theme?: "split" | "light" | "dark";
  /** Wraps the sections in `data-density="compact"`. */
  density: "comfortable" | "compact";
  /** The section page to show. Unset shows the overview. */
  section?: string;
  /** Passed to sections as `SectionProps.open`. */
  open?: string;
}
