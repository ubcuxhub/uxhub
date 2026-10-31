import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * The numbers behind "Showing 1–10 of 48 · Page 1 of 5". `page` is clamped to
 * the last page, and an empty list reads "Showing 0 of 0".
 */
export function getPageSummary(page: number, pageSize: number, total: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const from = count === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(current * size, count);
  const range = count === 0 ? "Showing 0 of 0" : `Showing ${from}–${to} of ${count}`;
  const pageLabel = `Page ${current} of ${pageCount}`;

  return {
    page: current,
    from,
    to,
    pageCount,
    range,
    pageLabel,
    label: `${range} · ${pageLabel}`,
  };
}

type PaginationProps = Omit<React.ComponentProps<"nav">, "onChange"> & {
  /** 1-based; clamped to the last page. */
  page: number;
  pageSize: number;
  /** 0 renders nothing. */
  total: number;
} & (
    | {
        /** Client lists. */
        onPageChange: (page: number) => void;
        getPageHref?: never;
      }
    | {
        /** Server lists (`?page=2`). */
        getPageHref: (page: number) => string;
        onPageChange?: never;
      }
  );

/**
 * Sits at the foot of a TableCard (§3.4). Previous and next are circular icon
 * buttons, disabled at the ends. With `getPageHref` they are links, so a
 * server-rendered list pages without client state.
 */
function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  getPageHref,
  className,
  ...props
}: PaginationProps) {
  if (total <= 0) return null;

  const summary = getPageSummary(page, pageSize, total);
  const atStart = summary.page <= 1;
  const atEnd = summary.page >= summary.pageCount;

  const step = (label: string, target: number, disabled: boolean, icon: React.ReactNode) =>
    getPageHref && !disabled ? (
      <Link
        href={getPageHref(target)}
        aria-label={label}
        className={buttonVariants({ variant: "secondary", size: "icon" })}
      >
        {icon}
      </Link>
    ) : (
      <IconButton
        label={label}
        disabled={disabled}
        onClick={() => onPageChange?.(target)}
      >
        {icon}
      </IconButton>
    );

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border-subtle px-5 py-3 text-small",
        className,
      )}
      {...props}
    >
      {/* The visible text is split around the buttons; this is what is announced. */}
      <p aria-live="polite" className="sr-only">
        {summary.label}
      </p>
      <p aria-hidden className="whitespace-nowrap text-muted-foreground tabular-nums">
        {summary.range}
      </p>
      <div className="ml-auto flex items-center gap-3">
        {step(
          "Previous page",
          summary.page - 1,
          atStart,
          <ChevronLeft aria-hidden />,
        )}
        <span aria-hidden className="whitespace-nowrap text-foreground tabular-nums">
          {summary.pageLabel}
        </span>
        {step(
          "Next page",
          summary.page + 1,
          atEnd,
          <ChevronRight aria-hidden />,
        )}
      </div>
    </nav>
  );
}

export { Pagination };
