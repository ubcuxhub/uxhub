import type { RegistryEntry } from "./types";

/**
 * Registry shard: form fields and pickers. Each shard is owned by one line of
 * work, so parallel PRs add entries without touching each other's files. An
 * entry's `category` is independent of its shard, and order here does not
 * matter: the index and sidebar sort by title.
 *
 * Every entry also needs a loader in this shard's `.demos.ts` file, and its
 * demo in `../_demos/<slug>.tsx` (a default-exported
 * `ComponentType<SectionProps>`).
 */
export const formsEntries: readonly RegistryEntry[] = [
  {
    slug: "form-controls",
    title: "Form controls",
    category: "Forms",
    tier: "primitive",
    description:
      "Inputs, textareas, selects, checkboxes and switches, laid out with Field and Label in any form.",
    spec: "§3.2, §3.11, §3.12",
    layout: "split",
    openStates: ["select"],
  },
  {
    slug: "choice-controls",
    title: "Choice controls",
    category: "Forms",
    tier: "primitive",
    description:
      "Pick from a few options: radios in a form, a SegmentedToggle to switch views, FilterChips to narrow a list.",
    spec: "§3.2, §3.3, §3.12",
    layout: "split",
  },
  {
    slug: "field-extensions",
    title: "Field extensions and slider",
    category: "Forms",
    tier: "primitive",
    description:
      "Add-ons for a field (a leading icon, an action in the label row, a character counter) and the Slider.",
    spec: "§3.2, §3.12, §3.17",
    layout: "split",
  },
  {
    slug: "date-time",
    title: "Date and time",
    category: "Forms",
    tier: "primitive",
    description:
      "Typed date and time fields with their pickers, for event schedules and deadlines.",
    spec: "§3.11",
    layout: "split",
    openStates: ["date-open", "time-open", "end-time-open"],
  },
  {
    slug: "colour-picker",
    title: "Colour picker",
    category: "Forms",
    tier: "primitive",
    description:
      "Let an admin pick an event colour from the swatches, or a custom one.",
    importPath: "@/components/ui/colour-picker",
    importNames: ["ColourPicker"],
    source: "src/components/ui/colour-picker.tsx",
    spec: "§3.10",
    layout: "split",
    openStates: ["custom-colour"],
  },
  {
    slug: "searchable-dropdown",
    title: "Searchable dropdown",
    category: "Forms",
    tier: "primitive",
    description:
      "Choose one or many from a long list by typing, such as members or judges.",
    importPath: "@/components/ui/searchable-dropdown",
    importNames: ["SearchableDropdown"],
    source: "src/components/ui/searchable-dropdown.tsx",
    spec: "§3.13",
    layout: "split",
    openStates: ["typing", "no-results"],
  },
  {
    slug: "media",
    title: "Image upload and Hubbo",
    category: "Forms",
    tier: "app",
    description:
      "Upload an event image with ImageUpload, and use the Hubbo mascot in empty and success states.",
    spec: "§3.12, §5.2",
    layout: "split",
  },
];
