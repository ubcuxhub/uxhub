import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "tabs-and-menus",
  title: "Tabs and menus",
  spec: "§3.4, §3.7",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      Tabs and DropdownMenu land in wave 1, PR C.
    </p>
  ),
};

export default section;
