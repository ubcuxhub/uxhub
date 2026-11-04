import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocPage } from "@/app/dev/_shell/DocPage";

import { entryBySlug } from "../_registry";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const entry = entryBySlug((await params).slug);
  return entry ? { title: `${entry.title} · UX Hub components` } : {};
}

/** One component's docs page. Loads that component's demo and no other. */
export default async function ComponentPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!entryBySlug(slug)) notFound();
  return <DocPage slug={slug} />;
}
