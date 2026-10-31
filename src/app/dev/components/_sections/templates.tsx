import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "templates",
  title: "Templates",
  spec: "§4.4",
  layout: "page",
  Component: () => (
    <p className="text-small text-muted-foreground">
      Page templates land in the wave-2 wrap-up.
    </p>
  ),
};

export default section;
