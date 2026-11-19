"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EventPageStatus } from "@/features/events/components/EventPageStatus";

/**
 * The event page, or its apply and checkout steps, threw while loading: the
 * database or the network failed (Figma 1.19). A missing event is not an error
 * here; it calls notFound(), which passes this boundary for not-found.tsx.
 *
 * As in the shell's error.tsx, a server error arrives as a digest only and is
 * already reported (scrubbed) by `onRequestError` in src/instrumentation.ts;
 * this reports client-side crashes.
 */
export default function EventPageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <EventPageStatus
      title="We couldn't load this event"
      description="Check your connection and try again. If it still doesn't load, the event may have been removed."
      action={
        // retry() re-fetches the segment's server data, unlike reset().
        <Button loading={pending} onClick={() => startTransition(() => retry())}>
          Try again
        </Button>
      }
    />
  );
}
