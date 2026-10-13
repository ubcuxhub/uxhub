"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import "./globals.css";

// Last-resort boundary: replaces the root layout when it throws, and catches
// errors from route groups without their own error.tsx (marketing and auth).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="text-body antialiased">
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="text-h1 tracking-tight">Something went wrong</h1>
            <p className="text-muted-foreground">
              This page failed to load. Trying again usually fixes it.
            </p>
          </div>

          <Button onClick={reset}>Try again</Button>
        </main>
      </body>
    </html>
  );
}
