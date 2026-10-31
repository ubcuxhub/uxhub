import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "media",
  title: "Image upload and Hubbo",
  spec: "§3.12, §5.2",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      ImageUpload states and Hubbo slots land in wave 2, PR J.
    </p>
  ),
};

export default section;
