"use client";

import { useState } from "react";
import { Check, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { AutosaveState } from "../lib/autosave";

const ANNOUNCE_SAVED = "Your answers are saved.";
const ANNOUNCE_FAILED = "Your answers couldn’t be saved.";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * Where the application header says how autosave is doing: "Saving…",
 * "Saved · 2:41 PM" (the time from `sm` up), or "Couldn't save" with Retry.
 * Screen readers hear only the turns between saved and failed, not every
 * save while typing: the live region's text changes only on those.
 */
export function AutosaveStatus({
  state,
  onRetry,
  className,
}: {
  state: AutosaveState;
  onRetry: () => void;
  className?: string;
}) {
  const message =
    state.kind === "saved" ? ANNOUNCE_SAVED : state.kind === "failed" ? ANNOUNCE_FAILED : null;
  const [announced, setAnnounced] = useState("");
  if (message !== null && message !== announced) setAnnounced(message);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-small text-muted-foreground",
        className
      )}
    >
      {state.kind === "pending" || state.kind === "saving" ? (
        <>
          <Spinner size="sm" />
          <span className="truncate">Saving…</span>
        </>
      ) : state.kind === "saved" ? (
        <>
          <Check aria-hidden className="size-4 shrink-0" />
          <span className="truncate">
            Saved
            <span className="max-sm:hidden"> · {timeFormat.format(state.at)}</span>
          </span>
        </>
      ) : state.kind === "failed" ? (
        <>
          <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
          <span className="truncate text-destructive">Couldn’t save</span>
          <Button type="button" variant="link" size="sm" className="px-1.5" onClick={onRetry}>
            Retry
          </Button>
        </>
      ) : state.kind === "idle" ? (
        <span className="truncate">Saves automatically</span>
      ) : null}
      <span role="status" className="sr-only">
        {announced}
      </span>
    </div>
  );
}
