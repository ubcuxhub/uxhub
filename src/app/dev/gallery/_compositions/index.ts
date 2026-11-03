import type { ComponentType } from "react";

import { ADMIN_COMPONENTS } from "./admin";
import { APPLICATION_COMPONENTS } from "./applications";
import { BUILDER_COMPONENTS } from "./builder";
import { EVENT_COMPONENTS } from "./events";
import { MANIFEST, type CompositionId } from "./manifest";
import { MEMBERSHIP_COMPONENTS } from "./membership";
import { NAVIGATION_COMPONENTS } from "./navigation";
import { COLUMNS, type Column } from "./types";

export { COLUMNS, type Column };

/** Every composition's component. A missing or unknown id fails type-checking. */
const COMPONENTS: Record<CompositionId, ComponentType> = {
  ...EVENT_COMPONENTS,
  ...MEMBERSHIP_COMPONENTS,
  ...ADMIN_COMPONENTS,
  ...APPLICATION_COMPONENTS,
  ...BUILDER_COMPONENTS,
  ...NAVIGATION_COMPONENTS,
};

/** The compositions of one column, top to bottom, with their components. */
export function columnOf(column: Column) {
  return MANIFEST.filter((entry) => entry.column === column).map((entry) => ({
    ...entry,
    Component: COMPONENTS[entry.id],
  }));
}
