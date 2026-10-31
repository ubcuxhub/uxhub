import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "route-tabs",
  title: "Route tabs",
  spec: "§3.4",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      TabNav lands in wave 2, PR Q.
    </p>
  ),
};

export default section;
