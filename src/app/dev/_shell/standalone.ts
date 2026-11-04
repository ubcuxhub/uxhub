import type { DocMeta } from "./types";

/**
 * Docs pages outside the component registry: they are not components, so the
 * index and the categories leave them out.
 */
export const STANDALONE = {
  foundations: {
    path: "/dev/foundations",
    title: "Foundations",
    description:
      "Colour, type, radius, focus ring, icons, elevation, motion and density: the tokens every component is built from.",
    spec: "§2",
    layout: "split",
  },
  gallery: {
    path: "/dev/gallery",
    title: "Gallery",
    description:
      "UX Hub flows assembled from the real components on fixture data, on a canvas that scrolls one axis at a time.",
    spec: "§3–4",
    layout: "canvas",
  },
  templates: {
    path: "/dev/templates",
    title: "Templates",
    description:
      "Whole pages assembled from the components on fixture data: the events list, event detail and event builder.",
    spec: "§4.4",
    layout: "page",
    // `<id>-frame` (the mobile iframe) is understood too, but not listed.
    openStates: ["events", "event-detail", "event-builder"],
  },
} as const satisfies Record<string, DocMeta & { path: string }>;

export type StandaloneId = keyof typeof STANDALONE;

/** Whether `pathname` is a page drawn edge to edge ("canvas" layout). */
export function isCanvasPath(pathname: string) {
  return Object.values(STANDALONE).some(
    (page) => page.path === pathname && page.layout === "canvas",
  );
}
