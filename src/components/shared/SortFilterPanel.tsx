"use client";

import { ListFilter } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SortFilterPanelProps
  extends Omit<React.ComponentProps<typeof Popover>, "children"> {
  activeCount?: number;
  summary: string;
  onClearAll: () => void;
  children: React.ReactNode;
  className?: string;
}

interface SortFilterSectionProps extends React.ComponentProps<"fieldset"> {
  title: string;
}

/**
 * One labelled control group in a SortFilterPanel. A fieldset makes its title
 * the accessible group name without requiring callers to coordinate ids.
 */
function SortFilterSection({
  title,
  className,
  children,
  ...props
}: SortFilterSectionProps) {
  return (
    <fieldset
      data-slot="sort-filter-section"
      className={cn("min-w-0 space-y-2", className)}
      {...props}
    >
      <legend className="text-small font-medium text-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Sort-and-filter popover for admin lists (§3.16). State belongs to the caller:
 * chip changes apply immediately and clicking inside the panel does not close
 * it. Radix restores focus to the trigger when the panel closes.
 */
function SortFilterPanel({
  activeCount = 0,
  summary,
  onClearAll,
  children,
  className,
  ...popoverProps
}: SortFilterPanelProps) {
  const titleId = useId();
  const count = Math.max(0, activeCount);
  const triggerLabel =
    count > 0 ? `Sort and filter, ${count} active` : "Sort and filter";

  return (
    <Popover {...popoverProps}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={triggerLabel}
        >
          <ListFilter aria-hidden />
          Sort and filter{count > 0 ? ` · ${count}` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        aria-labelledby={titleId}
        className={cn(
          "flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-xl p-5",
          className,
        )}
      >
        <h2 id={titleId} className="sr-only">
          Sort and filter
        </h2>
        {children}
        <div
          data-slot="sort-filter-footer"
          className="flex items-center justify-between border-t border-border-subtle pt-3"
        >
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-primary"
            onClick={onClearAll}
          >
            Clear all
          </Button>
          <p
            role="status"
            className="text-small text-muted-foreground tabular-nums"
          >
            {summary}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { SortFilterPanel, SortFilterSection };
export type { SortFilterPanelProps, SortFilterSectionProps };
