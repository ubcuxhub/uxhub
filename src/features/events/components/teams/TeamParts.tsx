"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { displayInviteLink } from "../../lib/teams";

/** How long the button says "Copied" after a copy. */
const COPIED_MS = 2000;

/**
 * "Invite link": the link in a read-only pill, and a Copy link button
 * (7.2, 7.3). The pill is a real input, so the link can be selected and
 * copied by hand when the clipboard is blocked.
 */
export function InviteLinkField({ url }: { url: string }) {
  const labelId = useId();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      toast.error("Couldn't copy the link", {
        description: "Select the link and copy it yourself.",
      });
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-small font-medium text-foreground">
        Invite link
      </p>
      <div className="flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted px-3">
          <Link className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            readOnly
            value={displayInviteLink(url)}
            aria-labelledby={labelId}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 truncate bg-transparent text-small text-foreground outline-none"
          />
        </div>
        <Button type="button" variant="secondary" onClick={copy}>
          {/* Both labels share one grid cell, so the button keeps the width
              of the longer one and the link beside it doesn't jump. */}
          <span className="grid justify-items-center">
            <span className={cn("col-start-1 row-start-1", copied && "invisible")}>Copy link</span>
            <span className={cn("col-start-1 row-start-1", !copied && "invisible")}>Copied</span>
          </span>
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Invite link copied" : ""}
      </span>
    </div>
  );
}

/**
 * One person on a team: their avatar, name, and a role on the right ("You ·
 * Owner"). `compact` is the tighter, borderless row in the Join dialog (7.5).
 */
export function TeamMemberRow({
  name,
  label,
  compact = false,
}: {
  name: string;
  label: string | null;
  compact?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3",
        compact ? "py-2" : "border-b border-border-subtle py-3",
      )}
    >
      <Avatar name={name} size={40} decorative />
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-foreground",
          compact ? "text-small" : "text-body",
        )}
      >
        {name}
      </p>
      {label ? <p className="shrink-0 text-small text-muted-foreground">{label}</p> : null}
    </li>
  );
}
