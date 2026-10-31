"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

interface SegmentedToggleProps
  extends Omit<
    React.ComponentProps<typeof ToggleGroupPrimitive.Root>,
    "type" | "value" | "defaultValue" | "onValueChange"
  > {
  value?: string;
  defaultValue?: string;
  /** Never called with `""`: pressing the selected option again does nothing. */
  onValueChange?: (value: string) => void;
  "aria-label": string;
}

/**
 * Pill switch between two or three views of the same list (§3.2). It switches
 * a view and never submits. Radix gives the items `role="radio"` and roving
 * focus (arrows move focus; Space or Enter selects).
 *
 * The track is 44px on phones and 36px from `sm` (Figma: 3px padding around a
 * 28px option), following `--size-control` so compact density shrinks it too.
 * `className="w-full"` stretches the options to share the width.
 */
function SegmentedToggle({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SegmentedToggleProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value ?? inner;

  function handleChange(next: string) {
    // Radix reports "" when the selected item is pressed again. One option
    // always stays on, so swallow it.
    if (!next) return;
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  }

  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-toggle"
      type="single"
      value={current ?? ""}
      onValueChange={handleChange}
      className={cn(
        "inline-flex h-11 items-stretch gap-0.5 rounded-full border border-border-subtle bg-muted p-[3px] sm:h-[calc(var(--size-control)-4px)]",
        "[&.w-full>[data-slot=segmented-toggle-item]]:flex-1",
        className,
      )}
      {...props}
    />
  );
}

/** One option. Put an optional 16px icon before the label. */
function SegmentedToggleItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-toggle-item"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-label whitespace-nowrap text-muted-foreground transition-colors duration-150 select-none hover:text-foreground focus-visible:focus-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        "data-[state=on]:border-border data-[state=on]:bg-card data-[state=on]:text-foreground",
        "disabled:cursor-not-allowed disabled:text-text-disabled disabled:opacity-60 disabled:hover:text-text-disabled",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedToggle, SegmentedToggleItem };
export type { SegmentedToggleProps };
