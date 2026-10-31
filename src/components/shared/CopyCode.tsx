"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

import { cn } from "@/lib/utils";

/** How long "Code Copied!" stays before the code comes back. */
const COPIED_DURATION_MS = 1000;
/** Matches `duration-300` below; after it, a hidden layer resets out of sight. */
const TRANSITION_MS = 300;

/**
 * A layer is `shown`, `leaving` (shrinking away), or `waiting` (hidden and
 * slightly enlarged, so its next entrance shrinks onto the page).
 */
type LayerState = "shown" | "leaving" | "waiting";

const LAYER_CLASSES: Record<LayerState, string> = {
  shown: "scale-100 opacity-100",
  leaving: "scale-75 opacity-0",
  // No transition: the jump to the enlarged size happens while invisible.
  waiting: "scale-125 opacity-0 transition-none",
};

// A slight overshoot gives the bounce.
const TRANSITION =
  "transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none";

interface CopyCodeProps {
  code: string;
}

/**
 * A pill showing `code` with a copy button. After a copy, the code and icon
 * shrink away while "Code Copied!" shrinks in, then the reverse.
 */
export function CopyCode({ code }: CopyCodeProps) {
  const [copied, setCopied] = useState(false);
  // False while the layer that just left is still animating out.
  const [settled, setSettled] = useState(true);
  const [failed, setFailed] = useState(false);
  const revertTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(revertTimer.current);
      window.clearTimeout(settleTimer.current);
    },
    []
  );

  function switchTo(nextCopied: boolean) {
    setCopied(nextCopied);
    setSettled(false);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettled(true), TRANSITION_MS);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setFailed(true);
      return;
    }

    setFailed(false);
    if (!copied) switchTo(true);
    // A second copy while "Code Copied!" shows restarts the countdown.
    window.clearTimeout(revertTimer.current);
    revertTimer.current = window.setTimeout(() => switchTo(false), COPIED_DURATION_MS);
  }

  const codeLayer: LayerState = !copied ? "shown" : settled ? "waiting" : "leaving";
  const copiedLayer: LayerState = copied ? "shown" : settled ? "waiting" : "leaving";

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex h-10 w-48 items-center rounded-full bg-muted text-muted-foreground">
        <span className={cn("pl-4 text-small", TRANSITION, LAYER_CLASSES[codeLayer])}>
          {code}
        </span>

        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center text-small justify-center",
            TRANSITION,
            LAYER_CLASSES[copiedLayer]
          )}
        >
          Code Copied!
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy discount code"
          className="ml-auto mr-1 flex size-8 items-center justify-center rounded-full outline-none focus-visible:focus-ring"
        >
          <Copy className={cn("size-4", TRANSITION, LAYER_CLASSES[codeLayer])} aria-hidden />
        </button>
      </div>

      {/* Announced to screen readers; the visible "Code Copied!" above is hidden from them. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Code copied" : ""}
      </span>
      <p aria-live="polite" className="text-small text-error">
        {failed ? "Failed to copy code." : ""}
      </p>
    </div>
  );
}
