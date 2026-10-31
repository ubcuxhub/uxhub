import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "lists",
  title: "Lists and sponsor logos",
  spec: "§4.1, §4.2",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      ListCard, ListRow and SponsorLogoGrid land in wave 2, PR O.
    </p>
  ),
};

export default section;
