import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A short, non-interactive state label (§3.3) or outlined tag (§3.15).
 *
 * Tones are the `variant`: `success`, `warning`, `error`, `info`, `neutral`
 * and `tag`. The shadcn names still work as aliases (`default` = `info`,
 * `secondary` = `neutral`, `destructive` = `error`, `outline` = `tag`).
 *
 * Every variant carries a 1px border (transparent unless it is a tag) so all
 * badges share one height, and callers' `border-*` tones keep working.
 * Put a lucide icon first; it is sized to 14px.
 *
 * Still a `div` (not a `span`): `AdminDirectoryFilters` nests one in a button
 * and the admin tests read its accessible name ("Filters 2"), which needs the
 * block boundary. Switch to `span` when that call site adopts it.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-transparent text-badge [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        error: "bg-error-bg text-error",
        info: "bg-info-bg text-info",
        neutral: "bg-surface-subtle text-fg-secondary",
        tag: "border-border bg-transparent text-foreground",
        /** @deprecated Use `info`. */
        default: "bg-info-bg text-info",
        /** @deprecated Use `neutral`. */
        secondary: "bg-surface-subtle text-fg-secondary",
        /** @deprecated Use `error`. */
        destructive: "bg-error-bg text-error",
        /** @deprecated Use `tag`. */
        outline: "border-border bg-transparent text-foreground",
      },
      size: {
        // A leading icon has built-in whitespace, so it gets less padding on
        // that side to look even with the label's side.
        default: "px-[7px] py-px has-[>svg:first-child]:pl-[5px]",
        large: "px-[11px] py-[3px] text-label has-[>svg:first-child]:pl-[9px]",
      },
    },
    defaultVariants: {
      variant: "info",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
