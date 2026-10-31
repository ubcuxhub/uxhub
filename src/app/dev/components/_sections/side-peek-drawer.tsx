import type { GallerySection } from "../_gallery/types";

const section: GallerySection = {
  id: "side-peek-drawer",
  title: "Side peek drawer",
  spec: "§3.15",
  layout: "page",
  Component: () => (
    <p className="text-small text-muted-foreground">
      SidePeekDrawer, DetailRow and TransactionRow land in wave 2, PR M.
    </p>
  ),
};

export default section;
