import type { DemoLoader } from "@/app/dev/_shell/types";

import { dataDemos } from "./data.demos";
import { formsDemos } from "./forms.demos";
import { interactionDemos } from "./interaction.demos";

/**
 * Every entry's demo loader, by slug. Import this only from client code that
 * shows one demo (`DocPage`): anything that imports it can reach every demo.
 */
export const DEMO_LOADERS: Readonly<Record<string, DemoLoader>> = {
  ...formsDemos,
  ...dataDemos,
  ...interactionDemos,
};
