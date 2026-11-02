import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `data.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const dataDemos: Record<string, DemoLoader> = {
  card: () => import("../_demos/card"),
  badge: () => import("../_demos/badge"),
  "status-badge": () => import("../_demos/status-badge"),
  separator: () => import("../_demos/separator"),
  avatar: () => import("../_demos/avatar"),
  table: () => import("../_demos/table"),
  "stat-card": () => import("../_demos/stat-card"),
  "table-toolbar": () => import("../_demos/table-toolbar"),
  "sort-filter-panel": () => import("../_demos/sort-filter-panel"),
  "list-row": () => import("../_demos/list-row"),
  alert: () => import("../_demos/alert"),
  skeleton: () => import("../_demos/skeleton"),
  "copy-code": () => import("../_demos/copy-code"),
  "success-overlay": () => import("../_demos/success-overlay"),
  pagination: () => import("../_demos/pagination"),
  "search-field": () => import("../_demos/search-field"),
  "confirm-dialog": () => import("../_demos/confirm-dialog"),
  "back-button": () => import("../_demos/back-button"),
  "event-card": () => import("../_demos/event-card"),
  "sponsor-logo-grid": () => import("../_demos/sponsor-logo-grid"),
  ticket: () => import("../_demos/ticket"),
};
