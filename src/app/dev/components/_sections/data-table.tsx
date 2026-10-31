import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "data-table",
  title: "Table",
  spec: "§3.6, §3.16",
  layout: "page",
  Component: () => (
    <p className="text-small text-muted-foreground">
      Table, Pagination, SearchField and TableToolbar land in wave 1, PR E.
    </p>
  ),
};

export default section;
