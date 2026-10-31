import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "colour-picker",
  title: "Colour picker",
  spec: "§3.10",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      ColourSwatch and ColourPicker land in wave 2, PR H.
    </p>
  ),
};

export default section;
