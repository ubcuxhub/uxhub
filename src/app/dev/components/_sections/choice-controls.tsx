import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "choice-controls",
  title: "Choice controls",
  spec: "§3.2, §3.3, §3.12",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      RadioGroup, SegmentedToggle and FilterChip land in wave 1, PR B.
    </p>
  ),
};

export default section;
