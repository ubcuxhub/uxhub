import type { ComponentType } from "react";

import type { CompositionId } from "./manifest";

/** The canvas's columns, left to right. */
export const COLUMNS = [1, 2, 3, 4, 5, 6] as const;
export type Column = (typeof COLUMNS)[number];

/**
 * One card on the canvas, as data. It renders with no caption: the card is
 * the whole composition.
 */
export interface CompositionMeta {
  /** Stable kebab-case id: the React key, `data-composition`, and the key of its component. */
  id: string;
  /** Which column it sits in. */
  column: Column;
  /** Registry slugs it is built from. Not shown; see `manifest.ts`. */
  uses: readonly string[];
}

/** Some of the compositions' components, keyed by id. */
export type Components = Partial<Record<CompositionId, ComponentType>>;
