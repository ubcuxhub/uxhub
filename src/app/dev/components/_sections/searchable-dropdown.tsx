import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "searchable-dropdown",
  title: "Searchable dropdown",
  spec: "§3.13",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      SearchableDropdown lands in wave 2, PR L.
    </p>
  ),
};

export default section;
