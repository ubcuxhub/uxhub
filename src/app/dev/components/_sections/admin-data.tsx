import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "admin-data",
  title: "Stats and filters",
  spec: "§3.5, §3.16",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      StatCard and SortFilterPanel land in wave 2, PR K.
    </p>
  ),
};

export default section;
