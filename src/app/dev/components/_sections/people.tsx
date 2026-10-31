import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "people",
  title: "Avatars",
  spec: "§3.9",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      Avatar and AvatarGroup land in wave 1, PR D.
    </p>
  ),
};

export default section;
