"use client";

// TEMPORARY: delete this folder before merging the Sentry PR.

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { logServerError, throwServerError } from "./actions";

export function SentryCheck() {
  const [status, setStatus] = useState("");

  return (
    <div className="flex flex-col items-start gap-4">
      <Button
        onClick={() => {
          throw new Error("sentry-check client error");
        }}
      >
        1. Throw in the browser
      </Button>

      <Button
        onClick={() =>
          throwServerError().catch(() => setStatus("Server action threw."))
        }
      >
        2. Throw in a server action
      </Button>

      <Button
        onClick={() =>
          logServerError().then(() => setStatus("log.error sent."))
        }
      >
        3. Call log.error
      </Button>

      {status ? <p className="text-muted-foreground">{status}</p> : null}
    </div>
  );
}
