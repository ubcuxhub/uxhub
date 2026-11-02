import type { ComponentType } from "react";

/**
 * Props every demo receives.
 *
 * A "split" demo can be rendered twice (light and dark columns, "Side by
 * side") at the same time, so ids and `htmlFor` pairs inside it must come
 * from `useId()`, never a literal.
 */
export interface SectionProps {
  /** Value of `?open=`, for forcing one overlay open. */
  open?: string;
}

/** A demo module: its default export renders the page's specimens. */
export type DemoModule = { default: ComponentType<SectionProps> };

/**
 * Imports one demo. Loaders live in files only the client docs page imports
 * (`components/_registry/*.demos.ts`, `DocPage.tsx`): a server page that
 * reaches an `import()` of a client module bundles it into its own route.
 */
export type DemoLoader = () => Promise<DemoModule>;

/**
 * What a docs page shows above and around its demo. Component entries
 * (`components/_registry`) and the standalone Foundations and Templates pages
 * (`standalone.ts`) both extend it. Plain data, so the index and the sidebar
 * can read it without pulling in any demo code.
 */
export interface DocMeta {
  /** "Buttons" */
  title: string;
  /** One line on when to reach for it, shown under the title. */
  description: string;
  /**
   * The module to import from, when the page documents one module
   * ("@/components/ui/button"). Shown as a copyable import line.
   */
  importPath?: string;
  /** Names the import line pulls from `importPath` ("Button", "IconButton"). */
  importNames?: readonly string[];
  /**
   * Repository path of the documented module ("src/components/ui/button.tsx"),
   * linked as "Source" on GitHub.
   */
  source?: string;
  /** Design-system reference, "§3.1". */
  spec: string;
  /**
   * "split": rendered twice, light | dark columns, when Side by side is on.
   * "page": rendered once, in the page theme (portaled overlays, full-width
   * compositions).
   *
   * A "split" page that is given an `open` state it lists in `openStates`
   * is rendered once as "page" instead: portaled content ignores a column's
   * theme, so those are checked with `theme=light` and `theme=dark`.
   */
  layout: "split" | "page";
  /** `?open=` values the demo understands, listed as links on its page. */
  openStates?: readonly string[];
}
