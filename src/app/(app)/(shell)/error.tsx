"use client";

import { useEffect } from "react";

import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";

// Paired with the loading boundary in this segment: once a Suspense boundary
// exists, a throw inside it would otherwise escape to the framework default.
// redirect() and notFound() are re-thrown past this (NEXT_REDIRECT /
// NEXT_NOT_FOUND), so the guards in src/lib/auth/guards.ts still work.
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="flex flex-1 flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-h1 tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            This page failed to load. Trying again usually fixes it.
          </p>
        </div>

        <Button onClick={reset}>Try again</Button>
      </div>
    </PageContainer>
  );
}
