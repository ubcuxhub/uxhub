import type { Metadata } from "next";

import { DocPage } from "@/app/dev/_shell/DocPage";

export const metadata: Metadata = { title: "Foundations · UX Hub components" };

/** The design tokens, in the components' docs shell. */
export default function FoundationsPage() {
  return <DocPage page="foundations" />;
}
