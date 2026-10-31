"use client";

import * as React from "react";
import { Toggle as TogglePrimitive } from "radix-ui";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface FilterChipProps
  extends React.ComponentProps<typeof TogglePrimitive.Root> {
  /** After the label, muted, and part of the accessible name ("Pending 12"). */
  count?: number;
}

/**
 * Toggleable pill that narrows a list (§3.3). Several can be on at once; use a
 * SegmentedToggle for one-of views. Radix Toggle supplies `aria-pressed`.
 *
 * On: `status-info-background` fill, `action-primary-strong` label and a leading
 * check, so selection is never shown by colour alone. In dark mode
 * `action-primary-strong` is blue-600 on blue-900 (about 2:1), so the label uses
 * `status-info-text` there. Disabled is 60% opacity.
 * On coarse pointers an invisible `::after` grows the 32px chip to a 44px target.
 */
function FilterChip({
  className,
  count,
  children,
  ...props
}: FilterChipProps) {
  return (
    <TogglePrimitive.Root
      data-slot="filter-chip"
      className={cn(
        "group/chip relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-label whitespace-nowrap text-muted-foreground transition-colors duration-150 select-none focus-visible:focus-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-[7px]",
        "not-data-[state=on]:enabled:hover:bg-muted",
        "data-[state=on]:border-status-info-background data-[state=on]:bg-status-info-background data-[state=on]:pl-2.5 data-[state=on]:text-action-primary-strong dark:data-[state=on]:text-status-info-text",
        "disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <Check
        aria-hidden
        className="hidden size-4 shrink-0 group-data-[state=on]/chip:block"
      />
      {children}
      {count !== undefined ? (
        <>
          {" "}
          <span className="text-xs leading-4 tabular-nums opacity-80">
            {count}
          </span>
        </>
      ) : null}
    </TogglePrimitive.Root>
  );
}

/** Chips sit above the list they filter, in one row with any Select. */
function FilterChipGroup({
  className,
  ...props
}: React.ComponentProps<"div"> & { "aria-label": string }) {
  return (
    <div
      data-slot="filter-chip-group"
      role="group"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

export { FilterChip, FilterChipGroup };
export type { FilterChipProps };
