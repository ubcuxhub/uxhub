import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "section-navigator",
  title: "Section navigator",
  spec: "§3.14",
  layout: "page",
  Component: () => (
    <p className="text-small text-muted-foreground">
      SectionNavigator lands in wave 2, PR N.
    </p>
  ),
};

export default section;
