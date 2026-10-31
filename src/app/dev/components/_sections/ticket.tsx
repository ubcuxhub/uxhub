import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "ticket",
  title: "Ticket",
  spec: "§2.1, §4.3",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      The compact Ticket lands in wave 2, PR P.
    </p>
  ),
};

export default section;
