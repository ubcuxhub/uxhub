import type { Metadata } from "next";

import { DocPage } from "@/app/dev/_shell/DocPage";

export const metadata: Metadata = { title: "Gallery · UX Hub components" };

/**
 * UX Hub compositions built from the real components on fixture data, laid
 * out in columns on a canvas that scrolls one axis at a time.
 */
export default function GalleryPage() {
  return <DocPage page="gallery" />;
}
