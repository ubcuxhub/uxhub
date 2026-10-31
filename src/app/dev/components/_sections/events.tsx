import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "events",
  title: "Event cards and timeline",
  spec: "§3.5, §3.9",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      EventCard and the EventTimeline restyle land in wave 2, PR I.
    </p>
  ),
};

export default section;
