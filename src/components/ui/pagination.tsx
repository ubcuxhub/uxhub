"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * The page a list should show for `page`: a whole number from 1 to the last
 * page. Use it in the data query too, so `?page=99` fetches the last page
 * rather than an offset past the end.
 */
export function clampPage(page: number, pageSize: number, total: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
}

/**
 * The numbers behind "Showing 1–10 of 48 · Page 1 of 5". `page` is clamped to
 * the last page, and an empty list reads "Showing 0 of 0".
 */
export function getPageSummary(page: number, pageSize: number, total: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = clampPage(page, size, count);
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
        /**
         * Client lists. Also called with the clamped page when `page` is out of
         * range (the list shrank, or `page` was 99), so state stays in step.
         */
        onPageChange: (page: number) => void;
        getPageHref?: never;
      }
    | {
        /** Server lists (`?page=2`). Clamp the query with `clampPage`. */
        getPageHref: (page: number) => string;
        onPageChange?: never;
      }
  );

/**
 * Sits at the foot of a TableCard (§3.4). Previous and next are circular icon
 * buttons, disabled at the ends. With `getPageHref` they are links, so a
 * server-rendered list pages without client state.
 *
 * Stepping onto the first or last page with the keyboard moves focus to the
 * other button, which would otherwise be left on a disabled control. The
 * summary is announced when the page changes, not when results do, so it never
 * competes with a search field's own result count while typing.
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
  const summary = getPageSummary(page, pageSize, total);
  const atStart = summary.page <= 1;
  const atEnd = summary.page >= summary.pageCount;

  const prevRef = React.useRef<HTMLElement>(null);
  const nextRef = React.useRef<HTMLElement>(null);
  const keepFocus = React.useRef(false);

  // The announcement is set on a page change, never on mount or on `total`.
  const [announced, setAnnounced] = React.useState({
    page: summary.page,
    label: "",
  });
  if (announced.page !== summary.page) {
    setAnnounced({ page: summary.page, label: summary.label });
  }

  const outOfRange = total > 0 && page !== summary.page;
  React.useEffect(() => {
    if (outOfRange) onPageChange?.(summary.page);
  }, [outOfRange, summary.page, onPageChange]);

  React.useEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    if (atEnd && !atStart) prevRef.current?.focus();
    else if (atStart && !atEnd) nextRef.current?.focus();
  }, [summary.page, atStart, atEnd]);

  if (total <= 0) return null;

  const step = (
    ref: React.RefObject<HTMLElement | null>,
    label: string,
    target: number,
    disabled: boolean,
    icon: React.ReactNode,
  ) => {
    // A keyboard click reports `detail` 0; a pointer one doesn't need rescuing.
    const remember = (event: React.MouseEvent) => {
      keepFocus.current = event.detail === 0;
    };

    return getPageHref && !disabled ? (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={getPageHref(target)}
        aria-label={label}
        className={buttonVariants({ variant: "secondary", size: "icon" })}
        onClick={remember}
      >
        {icon}
      </Link>
    ) : (
      <IconButton
        ref={ref as React.Ref<HTMLButtonElement>}
        label={label}
        disabled={disabled}
        onClick={(event) => {
          remember(event);
          onPageChange?.(target);
        }}
      >
        {icon}
      </IconButton>
    );
  };

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
        {announced.label}
      </p>
      <p aria-hidden className="whitespace-nowrap text-muted-foreground tabular-nums">
        {summary.range}
      </p>
      <div className="ml-auto flex items-center gap-3">
        {step(
          prevRef,
          "Previous page",
          summary.page - 1,
          atStart,
          <ChevronLeft aria-hidden />,
        )}
        <span aria-hidden className="whitespace-nowrap text-foreground tabular-nums">
          {summary.pageLabel}
        </span>
        {step(
          nextRef,
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
