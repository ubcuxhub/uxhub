"use client";

import { useEffect } from "react";

import { RecordDrawerSkeleton } from "@/components/shared/RecordDrawer";
import { loadDocument } from "@/lib/load-document";

/**
 * Leaves a record drawer that opened for a URL that isn't a record (a page
 * beside the records, which a soft navigation reached through the drawer's
 * intercepted route) by loading that URL as a document. Shows the drawer's
 * loading state meanwhile.
 */
export function LoadAsDocument({ href }: { href: string }) {
  useEffect(() => {
    loadDocument(href);
  }, [href]);

  return <RecordDrawerSkeleton label="Loading page" />;
}
