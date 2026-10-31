import type { ComponentType } from "react";

/**
 * Props every gallery section receives.
 *
 * A "split" section is rendered twice (light and dark columns) at the same
 * time, so ids and `htmlFor` pairs inside it must come from `useId()`, never a
 * literal.
 */
export interface SectionProps {
  /** Value of `?open=`, for forcing one overlay open. */
  open?: string;
}

export interface GallerySection {
  /** kebab-case. Used by `?section=<id>` and as the `#<id>` anchor. */
  id: string;
  /** "Buttons" */
  title: string;
  /** Design-system reference, "§3.1". */
  spec: string;
  /**
   * "split": rendered twice, light | dark columns.
   * "page": rendered once, in the page theme (portaled overlays, full-width
   * compositions).
   *
   * A "split" section that is given an `open` state it lists in `openStates`
   * is rendered once as "page" instead: portaled content ignores a column's
   * theme, so those are checked with `theme=light` and `theme=dark`.
   */
  layout: "split" | "page";
  /** `?open=` values this section understands, listed as toolbar links. */
  openStates?: readonly string[];
  Component: ComponentType<SectionProps>;
}

/** Parsed query parameters, handled only in `Gallery.tsx`. */
export interface GalleryParams {
  /** `split` shows light and dark side by side; the others set the page theme. */
  theme: "split" | "light" | "dark";
  /** Wraps the sections in `data-density="compact"`. */
  density: "comfortable" | "compact";
  /** Render only this section. */
  section?: string;
  /** Passed to sections as `SectionProps.open`. */
  open?: string;
}
