import type { Metadata } from "next";

import { navGroups } from "./components/_registry";
import { DocsShell } from "./_shell/DocsShell";

export const metadata: Metadata = {
  title: "UX Hub components",
  robots: { index: false, follow: false },
};

// The shell reads `theme`, `density` and `open` from the query, so render on
// request: the first paint then already has the asked-for theme and density.
export const dynamic = "force-dynamic";

/**
 * Visual-check docs for the shared UI: `/dev/components` (index and one page
 * per component), `/dev/foundations` and `/dev/templates`. Reads no data and
 * needs no sign-in, so a reviewer (or a session that must not sign in) can
 * look at every component state.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell groups={navGroups()}>{children}</DocsShell>;
}
