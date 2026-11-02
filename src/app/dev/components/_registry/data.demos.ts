import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `data.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const dataDemos: Record<string, DemoLoader> = {
  surfaces: () => import("../_demos/surfaces"),
  people: () => import("../_demos/people"),
  "data-table": () => import("../_demos/data-table"),
  "admin-data": () => import("../_demos/admin-data"),
  lists: () => import("../_demos/lists"),
  events: () => import("../_demos/events"),
  ticket: () => import("../_demos/ticket"),
  composites: () => import("../_demos/composites"),
};
