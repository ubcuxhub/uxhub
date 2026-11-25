"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** How long the tick shows after a copy. */
const COPIED_MS = 2000;

/**
 * A 28px icon button that copies `value` (Figma 1.21: "Copy meeting ID",
 * "Copy passcode"). It shows a tick for two seconds after a copy, and a
 * toast if the clipboard is blocked, since the value is on screen to copy by
 * hand.
 */
export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error("Couldn't copy", { description: "Select it and copy it yourself." });
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="border-transparent text-muted-foreground"
      aria-label={copied ? `${label}: copied` : label}
      onClick={copy}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </Button>
  );
}
