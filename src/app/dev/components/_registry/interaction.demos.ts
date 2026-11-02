import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `interaction.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const interactionDemos: Record<string, DemoLoader> = {
  buttons: () => import("../_demos/buttons"),
  overlays: () => import("../_demos/overlays"),
  "side-peek-drawer": () => import("../_demos/side-peek-drawer"),
  navigation: () => import("../_demos/navigation"),
  "tabs-and-menus": () => import("../_demos/tabs-and-menus"),
  "route-tabs": () => import("../_demos/route-tabs"),
  "section-navigator": () => import("../_demos/section-navigator"),
  feedback: () => import("../_demos/feedback"),
};
