import { notFound } from "next/navigation";

import { showUnlaunchedPages } from "@/app/dev/_shell/nav";

/** Unlaunched student-events screens: not served in production. */
export default function Layout({ children }: { children: React.ReactNode }) {
  if (!showUnlaunchedPages) notFound();
  return children;
}
