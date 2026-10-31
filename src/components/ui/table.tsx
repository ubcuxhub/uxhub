"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Admin lists (§3.6, §3.16). A native `<table>` inside a card that scrolls
 * sideways, so rows keep their cell semantics: a clickable row holds a real
 * button (`TableRowButton`) stretched over the row instead of `role="button"`
 * on the `<tr>`.
 *
 * Rows are `--size-table-row` tall (56px, 40px compact). Cells are 20px from
 * the edge, as in Figma.
 */

/** The 52px checkbox column; the second sticky column sits right after it. */
const CHECKBOX_COLUMN = "w-13 min-w-13 max-w-13";

const StickyContext = React.createContext(false);

function TableCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-card"
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

interface TableProps extends React.ComponentProps<"table"> {
  /** Pins the first column while scrolling; with a checkbox column, the first two. */
  stickyFirstColumn?: boolean;
  /** Sets `aria-busy` while loading. */
  busy?: boolean;
  /** Classes for the scrolling wrapper. */
  scrollerClassName?: string;
}

function Table({
  className,
  scrollerClassName,
  stickyFirstColumn = false,
  busy = false,
  ...props
}: TableProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      scroller.dataset.scrollStart = String(scroller.scrollLeft <= 1);
      scroller.dataset.scrollEnd = String(scroller.scrollLeft >= max - 1);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <StickyContext value={stickyFirstColumn}>
      <div
        ref={scrollerRef}
        data-slot="table-scroller"
        // Both flags start `true` (nothing to scroll) until the effect measures.
        data-scroll-start="true"
        data-scroll-end="true"
        className={cn(
          "group/scroller w-full overflow-x-auto overflow-y-hidden",
          // A 24px fade on the side with more to scroll to (§3.16). The pinned
          // column already marks the start edge, so only the end fades there.
          "[--fade-end:0px] [--fade-start:0px] data-[scroll-end=false]:[--fade-end:24px]",
          !stickyFirstColumn && "data-[scroll-start=false]:[--fade-start:24px]",
          "[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-start),#000_calc(100%-var(--fade-end)),transparent)]",
          scrollerClassName,
        )}
      >
        <table
          data-slot="table"
          data-sticky={stickyFirstColumn || undefined}
          aria-busy={busy || undefined}
          className={cn(
            "w-full caption-bottom border-collapse text-table",
            // Pinned cells take their row's fill (`bg-inherit`), so selected and
            // hovered rows stay one colour under a scrolling cell.
            "data-sticky:[&_tr>:first-child]:sticky data-sticky:[&_tr>:first-child]:left-0 data-sticky:[&_tr>:first-child]:z-[1]",
            "data-sticky:[&_tr:has(>[data-slot=table-checkbox-cell]:first-child)>:nth-child(2)]:sticky data-sticky:[&_tr:has(>[data-slot=table-checkbox-cell]:first-child)>:nth-child(2)]:left-13 data-sticky:[&_tr:has(>[data-slot=table-checkbox-cell]:first-child)>:nth-child(2)]:z-[1]",
            // A hairline marks the pinned edge once something scrolls under it.
            "group-data-[scroll-start=false]/scroller:data-sticky:[&_tr:not(:has(>[data-slot=table-checkbox-cell]:first-child))>:first-child]:shadow-[1px_0_0_var(--border-subtle)]",
            "group-data-[scroll-start=false]/scroller:data-sticky:[&_tr:has(>[data-slot=table-checkbox-cell]:first-child)>:nth-child(2)]:shadow-[1px_0_0_var(--border-subtle)]",
            className,
          )}
          {...props}
        />
      </div>
    </StickyContext>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:bg-section", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("px-5 py-3 text-left text-small text-muted-foreground", className)}
      {...props}
    />
  );
}

const INTERACTIVE = "a,button,input,select,textarea,label,[role='button'],[role='menuitem']";

/**
 * A pinned cell holds the stretched button's positioning context, so it can
 * only cover its own cell. In a sticky table the row forwards a click anywhere
 * else to the row button; keyboard and assistive tech still use the button.
 */
function TableRow({ className, onClick, ...props }: React.ComponentProps<"tr">) {
  const sticky = React.useContext(StickyContext);

  return (
    <tr
      data-slot="table-row"
      className={cn(
        "relative border-b border-border-subtle bg-card transition-colors duration-150 last:border-b-0",
        "data-[state=selected]:bg-muted",
        "has-[[data-slot=table-row-button]]:cursor-pointer has-[[data-slot=table-row-button]]:hover:bg-accent has-[[data-slot=table-row-button]]:data-[state=selected]:hover:bg-muted",
        "has-[[data-slot=table-row-button]:focus-visible]:outline-2 has-[[data-slot=table-row-button]:focus-visible]:-outline-offset-2 has-[[data-slot=table-row-button]:focus-visible]:outline-ring",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!sticky || event.defaultPrevented) return;
        const target = event.target as HTMLElement;
        if (target.closest(INTERACTIVE)) return;
        event.currentTarget
          .querySelector<HTMLElement>("[data-slot=table-row-button]")
          ?.click();
      }}
      {...props}
    />
  );
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-(--size-table-row) bg-inherit px-5 text-left align-middle text-table-heading font-medium whitespace-nowrap text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-(--size-table-row) bg-inherit px-5 align-middle text-table text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The control that opens a row. A real `<button>` (or `asChild` for a `Link`)
 * whose `::after` covers the row, so a click anywhere on it activates while
 * Tab and Enter work from the name.
 */
function TableRowButton({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="table-row-button"
      {...(asChild ? {} : { type: "button" as const })}
      className={cn(
        "cursor-pointer text-left outline-none after:absolute after:inset-0 after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

type TableCheckboxCellProps = Omit<
  React.ComponentProps<"td">,
  "onChange" | "children"
> & {
  /** Renders a `<th scope="col">` for the header row. */
  header?: boolean;
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  /** Required: a checkbox alone has no name ("Select all results", "Select Alex Chen"). */
  "aria-label": string;
  disabled?: boolean;
};

/**
 * The 52px selection column. The checkbox is 20px but its label is a 44px hit
 * area, lifted above the row button so the two never overlap (§3.16).
 */
function TableCheckboxCell({
  header = false,
  checked,
  onCheckedChange,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...props
}: TableCheckboxCellProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  const mixed = checked === "indeterminate";

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);

  const Cell = header ? "th" : "td";

  return (
    <Cell
      data-slot="table-checkbox-cell"
      {...(header ? { scope: "col" as const } : {})}
      className={cn(
        "relative h-(--size-table-row) bg-inherit p-0",
        CHECKBOX_COLUMN,
        className,
      )}
      {...props}
    >
      <label className="absolute top-1/2 left-2 z-10 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center">
        <Checkbox
          ref={ref}
          checked={checked === true}
          disabled={disabled}
          aria-label={ariaLabel}
          onCheckedChange={onCheckedChange}
        />
      </label>
    </Cell>
  );
}

/** An empty cell: an en dash, read as "None" (§3.6). */
function TableNone({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="table-none" className={className} {...props}>
      <span aria-hidden className="text-muted-foreground">
        –
      </span>
      <span className="sr-only">None</span>
    </span>
  );
}

/** One full-width row saying what is missing, in plain words (§3.6). */
function TableEmpty({
  colSpan,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"td">, "colSpan"> & { colSpan: number }) {
  return (
    <tr data-slot="table-empty">
      <td
        colSpan={colSpan}
        className={cn(
          "px-5 py-10 text-center text-small text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </td>
    </tr>
  );
}

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5"];

/** Skeleton rows the shape of the data. Never a spinner (§3.6). */
function TableSkeleton({
  rows = 5,
  columns,
  selectable = false,
}: {
  rows?: number;
  /** Data columns, not counting the checkbox column. */
  columns: number;
  /** Adds a placeholder for the checkbox column. */
  selectable?: boolean;
}) {
  return Array.from({ length: rows }, (_, row) => (
    <TableRow key={row} data-slot="table-skeleton-row">
      {selectable ? (
        <td className={cn("h-(--size-table-row) bg-inherit pl-5", CHECKBOX_COLUMN)}>
          <Skeleton className="size-5 rounded-sm bg-muted" />
        </td>
      ) : null}
      {Array.from({ length: columns }, (_, col) => (
        <TableCell key={col}>
          <Skeleton
            className={cn(
              "h-4 bg-muted",
              SKELETON_WIDTHS[(row + col * 2) % SKELETON_WIDTHS.length],
            )}
          />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCard,
  TableCell,
  TableCheckboxCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowButton,
  TableSkeleton,
};
