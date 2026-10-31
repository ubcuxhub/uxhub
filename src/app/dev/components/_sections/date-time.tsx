import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "date-time",
  title: "Date and time",
  spec: "§3.11",
  layout: "split",
  Component: () => (
    <p className="text-small text-muted-foreground">
      DateTimeField, DatePicker and TimePicker land in wave 2, PR G.
    </p>
  ),
};

export default section;
