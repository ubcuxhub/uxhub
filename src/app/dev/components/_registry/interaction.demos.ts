import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `interaction.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const interactionDemos: Record<string, DemoLoader> = {
  button: () => import("../_demos/button"),
  "icon-button": () => import("../_demos/icon-button"),
  spinner: () => import("../_demos/spinner"),
  "action-banner": () => import("../_demos/action-banner"),
  "empty-state": () => import("../_demos/empty-state"),
  toast: () => import("../_demos/toast"),
  dialog: () => import("../_demos/dialog"),
  popover: () => import("../_demos/popover"),
  sheet: () => import("../_demos/sheet"),
  tooltip: () => import("../_demos/tooltip"),
  "side-peek-drawer": () => import("../_demos/side-peek-drawer"),
  "record-drawer": () => import("../_demos/record-drawer"),
  "dropdown-menu": () => import("../_demos/dropdown-menu"),
  sidebar: () => import("../_demos/sidebar"),
  tabs: () => import("../_demos/tabs"),
  "tab-nav": () => import("../_demos/tab-nav"),
  "section-navigator": () => import("../_demos/section-navigator"),
  "detail-row": () => import("../_demos/detail-row"),
  "transaction-row": () => import("../_demos/transaction-row"),
  "app-sidebar": () => import("../_demos/app-sidebar"),
};
