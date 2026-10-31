import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Dev tools",
  robots: { index: false, follow: false },
};

/**
 * Dev-only routes. `NODE_ENV` is "production" for `next build`, so deployed
 * builds (including Vercel previews) answer 404 and ship nothing from here.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
