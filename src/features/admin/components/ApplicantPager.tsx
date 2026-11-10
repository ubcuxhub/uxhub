"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** A neighbouring applicant in the list the reviewer came from. */
export interface PagerTarget {
  href: string;
  name: string;
}

interface ApplicantPagerProps {
  /** 1-based position in the list the reviewer came from. */
  position: number;
  total: number;
  /** What that list is ("Submitted", "All applicants"), so "3 of 18" has a scope. */
  scope: string;
  previous?: PagerTarget | null;
  next?: PagerTarget | null;
  /** Called before following a link; `preventDefault()` keeps the URL (the gallery). */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, direction: "previous" | "next") => void;
  className?: string;
}

/**
 * "3 of 18 · Submitted" with previous and next, on an application's page, so
 * a reviewer moves through the filtered list without going back to it. The
 * hrefs carry the list's query string, so the list's filters, search and sort
 * survive the trip (docs/design/application-review.md). At either end the
 * button stays, disabled, so the other doesn't jump.
 */
export function ApplicantPager({
  position,
  total,
  scope,
  previous,
  next,
  onNavigate,
  className,
}: ApplicantPagerProps) {
  return (
    <nav
      aria-label="Applicants"
      className={cn("flex items-center gap-3", className)}
    >
      <p className="text-small whitespace-nowrap text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{position}</span> of {total}
        <span className="text-muted-foreground"> · {scope}</span>
      </p>
      <div className="flex gap-2">
        <PagerLink
          direction="previous"
          target={previous}
          onNavigate={onNavigate}
        />
        <PagerLink direction="next" target={next} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function PagerLink({
  direction,
  target,
  onNavigate,
}: {
  direction: "previous" | "next";
  target?: PagerTarget | null;
  onNavigate?: ApplicantPagerProps["onNavigate"];
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const word = direction === "previous" ? "Previous" : "Next";

  if (!target) {
    return (
      <Button
        variant="secondary"
        size="icon"
        disabled
        aria-label={`No ${word.toLowerCase()} applicant`}
      >
        <Icon aria-hidden />
      </Button>
    );
  }

  const label = `${word} applicant: ${target.name}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="secondary" size="icon">
          <Link
            href={target.href}
            aria-label={label}
            rel={direction === "previous" ? "prev" : "next"}
            onClick={(event) => onNavigate?.(event, direction)}
          >
            <Icon aria-hidden />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
