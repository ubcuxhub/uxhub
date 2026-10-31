import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "feedback",
  title: "Feedback",
  spec: "§3.8",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      Toast, ActionBanner and EmptyState land in wave 1, PR A.
    </p>
  ),
};

export default section;
