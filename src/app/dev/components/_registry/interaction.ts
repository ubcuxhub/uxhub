import type { RegistryEntry } from "./types";

/**
 * Registry shard: actions, overlays, navigation and feedback. See `forms.ts`
 * for how shards work.
 */
export const interactionEntries: readonly RegistryEntry[] = [
  {
    slug: "buttons",
    title: "Buttons",
    category: "Actions",
    tier: "primitive",
    description:
      "Use a Button for an action on the page, and an IconButton when an icon alone says it (its label becomes the tooltip).",
    importPath: "@/components/ui/button",
    importNames: ["Button"],
    source: "src/components/ui/button.tsx",
    spec: "§3.1",
    layout: "split",
  },
  {
    slug: "overlays",
    title: "Overlays",
    category: "Overlays",
    tier: "primitive",
    description:
      "A Dialog for a focused task, a Sheet for a side panel, a Popover or Tooltip for small content anchored to a control.",
    spec: "§3.7, §2.6",
    layout: "page",
    openStates: [
      "dialog",
      "dialog-large",
      "dialog-mobile",
      "dialog-tall",
      "dialog-delete",
      "sheet-right",
      "sheet-left",
      "popover",
      "tooltip",
    ],
  },
  {
    slug: "side-peek-drawer",
    title: "Side peek drawer",
    category: "Overlays",
    tier: "primitive",
    description:
      "Open a record beside its list to read or edit it without leaving the page.",
    importPath: "@/components/ui/side-peek-drawer",
    importNames: ["SidePeekDrawer", "SidePeekDrawerContent"],
    source: "src/components/ui/side-peek-drawer.tsx",
    spec: "§3.15",
    layout: "page",
    openStates: ["drawer", "drawer-edit", "drawer-unsaved"],
  },
  {
    slug: "navigation",
    title: "Navigation",
    category: "Navigation",
    tier: "composite",
    description:
      "The app sidebar and its rows, for moving between the main portal and admin pages.",
    spec: "§3.4",
    layout: "split",
  },
  {
    slug: "tabs-and-menus",
    title: "Tabs and menus",
    category: "Navigation",
    tier: "primitive",
    description:
      "Tabs switch between parts of one object; a DropdownMenu holds its less common actions.",
    spec: "§3.4, §3.7",
    layout: "split",
    openStates: ["menu", "menu-confirm"],
  },
  {
    slug: "route-tabs",
    title: "Route tabs",
    category: "Navigation",
    tier: "primitive",
    description:
      "TabNav: tabs that are links, for sibling pages under one object's URL.",
    importPath: "@/components/ui/tab-nav",
    importNames: ["TabNav", "TabNavLink"],
    source: "src/components/ui/tab-nav.tsx",
    spec: "§3.4",
    layout: "split",
  },
  {
    slug: "section-navigator",
    title: "Section navigator",
    category: "Navigation",
    tier: "composite",
    description:
      "A floating pill that tracks progress through a long form and jumps between its sections.",
    importPath: "@/components/shared/SectionNavigator",
    importNames: ["SectionNavigator"],
    source: "src/components/shared/SectionNavigator.tsx",
    spec: "§3.14",
    layout: "page",
    openStates: ["menu"],
  },
  {
    slug: "feedback",
    title: "Feedback",
    category: "Feedback",
    tier: "primitive",
    description:
      "A Toast confirms what just happened, an ActionBanner asks for a next step, an EmptyState fills a list with nothing in it.",
    spec: "§3.8",
    layout: "split",
    openStates: ["toast-success", "toast-error", "toast-neutral", "toast-stack"],
  },
];
