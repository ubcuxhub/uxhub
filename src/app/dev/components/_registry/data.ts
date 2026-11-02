import type { RegistryEntry } from "./types";

/**
 * Registry shard: surfaces, records and the things that show them. See
 * `forms.ts` for how shards work.
 */
export const dataEntries: readonly RegistryEntry[] = [
  {
    slug: "surfaces",
    title: "Surfaces",
    category: "Data display",
    tier: "primitive",
    description:
      "Cards, badges, status badges, alerts, separators and skeletons: the containers and labels most pages are made of.",
    spec: "§3.3, §3.5, §3.6, §3.8",
    layout: "split",
  },
  {
    slug: "people",
    title: "Avatars",
    category: "Data display",
    tier: "primitive",
    description:
      "Avatars and avatar groups for people, with initials and anonymous fallbacks.",
    importPath: "@/components/ui/avatar",
    importNames: ["Avatar", "AvatarGroup"],
    source: "src/components/ui/avatar.tsx",
    spec: "§3.9",
    layout: "split",
  },
  {
    slug: "data-table",
    title: "Table",
    category: "Data display",
    tier: "primitive",
    description:
      "A table of records with search, selection and pagination, such as Manage Users.",
    importPath: "@/components/ui/table",
    importNames: [
      "Table",
      "TableBody",
      "TableCell",
      "TableHead",
      "TableHeader",
      "TableRow",
    ],
    source: "src/components/ui/table.tsx",
    spec: "§3.6, §3.16",
    layout: "page",
  },
  {
    slug: "admin-data",
    title: "Stats and filters",
    category: "Data display",
    tier: "composite",
    description:
      "StatCards for headline numbers, and the search, sort and filter toolbar above admin lists.",
    spec: "§3.5, §3.16",
    layout: "page",
    openStates: ["sort-filter"],
  },
  {
    slug: "lists",
    title: "Lists and sponsor logos",
    category: "Data display",
    tier: "composite",
    description:
      "ListRow for people and organizations, and the sponsor logo grid.",
    spec: "§4.1, §4.2",
    layout: "page",
  },
  {
    slug: "events",
    title: "Event cards and timeline",
    category: "Data display",
    tier: "app",
    description: "EventCard in every status, and the portal's EventTimeline.",
    spec: "§3.5, §3.9",
    layout: "split",
  },
  {
    slug: "ticket",
    title: "Ticket",
    category: "Data display",
    tier: "app",
    description:
      "The event ticket with its QR code, in each event colour and state.",
    importPath: "@/components/shared/Ticket",
    importNames: ["Ticket"],
    source: "src/components/shared/Ticket.tsx",
    spec: "§2.1, §4.3",
    layout: "split",
  },
  {
    slug: "composites",
    title: "Shared composites",
    category: "Data display",
    tier: "composite",
    description:
      "Shared building blocks: BackButton, PageContainer, CopyCode, SuccessOverlay and ConfirmDialog.",
    spec: "§3.5, §3.7, §4.5",
    layout: "split",
    openStates: ["confirm", "confirm-typed", "confirm-pending", "confirm-error"],
  },
];
