"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamsError({ reset }: { reset: () => void }) {
  return (
    <PageContainer>
      <EmptyState
        title="Couldn't load teams"
        description="Check your connection and try again."
        actions={<Button onClick={reset}>Try again</Button>}
      />
    </PageContainer>
  );
}
