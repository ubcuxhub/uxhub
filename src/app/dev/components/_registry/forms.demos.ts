import type { DemoLoader } from "@/app/dev/_shell/types";

/**
 * Demo loaders for the `forms.ts` shard, by slug. Kept apart from the
 * entries so the server pages that read the registry never reach a demo:
 * only the component page imports this, and it loads one demo.
 */
export const formsDemos: Record<string, DemoLoader> = {
  field: () => import("../_demos/field"),
  input: () => import("../_demos/input"),
  "password-input": () => import("../_demos/password-input"),
  textarea: () => import("../_demos/textarea"),
  select: () => import("../_demos/select"),
  checkbox: () => import("../_demos/checkbox"),
  switch: () => import("../_demos/switch"),
  "radio-group": () => import("../_demos/radio-group"),
  slider: () => import("../_demos/slider"),
  calendar: () => import("../_demos/calendar"),
  "date-picker": () => import("../_demos/date-picker"),
  "time-picker": () => import("../_demos/time-picker"),
  "date-time-field": () => import("../_demos/date-time-field"),
  "colour-picker": () => import("../_demos/colour-picker"),
  "searchable-dropdown": () => import("../_demos/searchable-dropdown"),
  "segmented-toggle": () => import("../_demos/segmented-toggle"),
  "filter-chip": () => import("../_demos/filter-chip"),
  "image-upload": () => import("../_demos/image-upload"),
  hubbo: () => import("../_demos/hubbo"),
};
