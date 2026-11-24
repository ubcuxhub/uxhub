"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function OverviewError({ reset }: { reset: () => void }) {
  return (
    <PageContainer>
      <EmptyState
        title="Couldn't load the overview"
        description="Check your connection and try again."
        actions={<Button onClick={reset}>Try again</Button>}
      />
    </PageContainer>
  );
}
