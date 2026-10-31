import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ActionBannerProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  /** "You're accepted to Design Sprint." */
  title: React.ReactNode;
  /** "Confirm your spot by Nov 14." */
  children?: React.ReactNode;
  /** Optional leading icon. The design shows none. */
  icon?: LucideIcon | null;
  /** One Button (or Button asChild Link) that names the step: "Confirm spot". */
  action?: React.ReactNode;
}

/**
 * Asks the member for a step they still need to take (§3.8, §4.3). At the top
 * of Home or an event page, above the back pill, one at a time; only the
 * Accepted status and the join prompt use it. Pass a `size="sm"` primary
 * Button as `action`.
 *
 * A labelled region, not `role="alert"`: it is present at load and must not
 * interrupt. No dismiss button. Never put a StatusBadge inside; the banner
 * carries the words.
 */
function ActionBanner({
  title,
  children,
  icon: Icon = null,
  action,
  className,
  ...props
}: ActionBannerProps) {
  const titleId = React.useId();
  return (
    <section
      data-slot="action-banner"
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border-subtle bg-background-secondary px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          id={titleId}
          data-slot="action-banner-title"
          className="text-small font-semibold text-foreground"
        >
          {title}
        </p>
        {children ? (
          <div
            data-slot="action-banner-body"
            className="text-label font-normal text-muted-foreground"
          >
            {children}
          </div>
        ) : null}
      </div>
      {action ? (
        <div data-slot="action-banner-action" className="shrink-0 max-sm:*:w-full">
          {action}
        </div>
      ) : null}
    </section>
  );
}

export { ActionBanner };
