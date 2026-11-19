"use client";

import { BackButton } from "@/components/shared/BackButton";
import { Hubbo } from "@/components/shared/Hubbo";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function EventBuilderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageContainer className="max-w-none space-y-6 min-[821px]:px-12 lg:px-12">
    <BackButton link="/admin/events" label="Back to Manage Events" className="h-8 w-fit px-4 text-small" />
    <EmptyState size="page" titleAs="h2" className="rounded-xl border border-border bg-card" media={<Hubbo emotion="thinking" className="h-40" />} title="We couldn’t load this event" description="Check your connection and try again. Anything you saved before is safe." actions={<Button onClick={reset}>Try again</Button>} />
  </PageContainer>;
}
