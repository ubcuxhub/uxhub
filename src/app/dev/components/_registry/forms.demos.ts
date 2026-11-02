import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `forms.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const formsDemos: Record<string, DemoLoader> = {
  "form-controls": () => import("../_demos/form-controls"),
  "choice-controls": () => import("../_demos/choice-controls"),
  "field-extensions": () => import("../_demos/field-extensions"),
  "date-time": () => import("../_demos/date-time"),
  "colour-picker": () => import("../_demos/colour-picker"),
  "searchable-dropdown": () => import("../_demos/searchable-dropdown"),
  media: () => import("../_demos/media"),
};
