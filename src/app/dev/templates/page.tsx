import type { Metadata } from "next";

import { DocPage } from "@/app/dev/_shell/DocPage";

export const metadata: Metadata = { title: "Templates · UX Hub components" };

/**
 * Whole pages on fixture data, in the components' docs shell. The mobile
 * preview iframes this page with `?open=<template>-frame`.
 */
export default function TemplatesPage() {
  return <DocPage page="templates" />;
}
