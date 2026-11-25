"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** External service tile; a missing destination is disabled with an accessible explanation. */
export function QuickLink({ title, description, icon, href, unavailable = "Link coming soon" }: {
  title: string; description: string; icon: ReactNode; href: string | null; unavailable?: string;
}) {
  const classes = "flex min-h-15 min-w-0 items-center justify-center gap-3 rounded-md border bg-card px-3 py-3 text-left transition-colors duration-fast focus-visible:focus-ring sm:min-h-17 sm:px-4";
  const content = <><span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center [&>*]:size-full sm:size-7.5">{icon}</span>
    <span className="min-w-0 wrap-anywhere"><span className="block text-label font-medium sm:text-body">{title}</span><span className="block text-badge font-normal text-muted-foreground sm:text-label">{description}</span></span></>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${title} (opens in a new tab)`} className={`${classes} hover:bg-muted active:bg-border-subtle`}>{content}</a>;
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={`${title}: ${unavailable}`} className="min-w-0 cursor-not-allowed rounded-md focus-visible:focus-ring">
    <button disabled aria-label={title} className={`${classes} h-full w-full cursor-not-allowed text-disabled-foreground opacity-50`}>{content}</button>
  </span></TooltipTrigger><TooltipContent>{unavailable}</TooltipContent></Tooltip>;
}
