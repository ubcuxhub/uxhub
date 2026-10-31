import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "field-extensions",
  title: "Field extensions and slider",
  spec: "§3.2, §3.12, §3.17",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      TextInput extras, the Textarea counter and Slider land in wave 2, PR F.
    </p>
  ),
};

export default section;
