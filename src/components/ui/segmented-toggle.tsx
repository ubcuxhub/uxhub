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
  /**
   * `md` (default) is the form control. `lg` is the page-level view switch
   * (Figma 3759:15793, the events timeline's Upcoming | Past): 34px options
   * with 16px labels on a borderless track.
   */
  size?: SegmentedToggleSize;
  "aria-label": string;
}

type SegmentedToggleSize = "md" | "lg";

/**
 * Pill switch between two or three views of the same list (§3.2). It switches
 * a view and never submits. Radix gives the items `role="radio"` and roving
 * focus. As in a radio group, the arrow keys (and Home and End) move focus and
 * select in one step; Space or Enter on the focused option also selects.
 *
 * The track is 44px on phones and 36px from `sm` (Figma: 3px padding around a
 * 28px option), following `--size-control` so compact density shrinks it too.
 * `className="w-full"` stretches the options to share the width.
 */
const SelectContext = React.createContext<((value: string) => void) | null>(
  null,
);
const SizeContext = React.createContext<SegmentedToggleSize>("md");

function SegmentedToggle({
  className,
  value,
  defaultValue,
  onValueChange,
  size = "md",
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
    <SelectContext.Provider
      value={(next) => {
        if (next !== current) handleChange(next);
      }}
    >
      <SizeContext.Provider value={size}>
        <ToggleGroupPrimitive.Root
          data-slot="segmented-toggle"
          data-size={size}
          type="single"
          value={current ?? ""}
          onValueChange={handleChange}
          className={cn(
            "inline-flex h-11 items-stretch rounded-full bg-muted",
            size === "md" &&
              "gap-0.5 border border-border-subtle p-[3px] sm:h-[calc(var(--size-control)-4px)]",
            // 4px apart, 4 x 2px around them: a 38px track from `sm`, 44px on phones.
            size === "lg" && "gap-1 px-1 py-0.5 sm:h-[38px]",
            "[&.w-full>[data-slot=segmented-toggle-item]]:flex-1",
            className,
          )}
          {...props}
        />
      </SizeContext.Provider>
    </SelectContext.Provider>
  );
}

/** One option. Put an optional 16px icon before the label. */
function SegmentedToggleItem({
  className,
  onFocus,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const select = React.useContext(SelectContext);
  const size = React.useContext(SizeContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-toggle-item"
      onFocus={(event) => {
        onFocus?.(event);
        if (event.defaultPrevented) return;
        // Focus arriving from a sibling option is an arrow, Home or End press
        // (or a click). Focus from outside the group (Tab in, a programmatic
        // focus) must not change the selection.
        const from = event.relatedTarget;
        if (from instanceof Node && event.currentTarget.parentElement?.contains(from)) {
          select?.(props.value);
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent px-3 whitespace-nowrap text-muted-foreground transition-colors duration-150 select-none hover:text-foreground focus-visible:focus-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        size === "md" && "text-label data-[state=on]:border-border",
        size === "lg" && "text-button data-[state=on]:border-border-subtle",
        "data-[state=on]:bg-card data-[state=on]:text-foreground",
        "disabled:cursor-not-allowed disabled:text-disabled-foreground disabled:opacity-60 disabled:hover:text-disabled-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedToggle, SegmentedToggleItem };
export type { SegmentedToggleProps };
