import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Building blocks for gallery sections. Specimens sit in an auto-fill grid so
 * rows line up; each carries a small caption naming the variant/state it shows.
 * `data-specimen` makes them easy to query when measuring in the browser.
 */

export function SpecimenGroup({
  title,
  spec,
  description,
  min = "11rem",
  className,
  children,
}: {
  title: string;
  /** Design-system reference, "§3.1". */
  spec?: string;
  description?: ReactNode;
  /** Minimum column width of the grid. */
  min?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-specimen-group={title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex items-baseline gap-2 text-subheading">
          {title}
          {spec ? (
            <span className="text-label text-muted-foreground">{spec}</span>
          ) : null}
        </h3>
        {description ? (
          <p className="max-w-prose text-small text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(var(--specimen-min),1fr))]",
          className,
        )}
        style={{ "--specimen-min": min } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

export function Specimen({
  label,
  wide = false,
  bare = false,
  className,
  children,
}: {
  /** Caption: the variant, size or state shown, e.g. "outline / default". */
  label: string;
  /** Span the whole row. */
  wide?: boolean;
  /** Skip the tile chrome (for specimens that bring their own surface). */
  bare?: boolean;
  /** Classes for the tile. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure
      data-specimen={label}
      className={cn("m-0 flex min-w-0 flex-col gap-1.5", wide && "col-span-full")}
    >
      <div
        className={cn(
          "flex min-h-16 flex-wrap items-center gap-3",
          !bare &&
            "rounded-xl border border-border-subtle bg-card p-4",
          className,
        )}
      >
        {children}
      </div>
      <figcaption className="px-1 text-label text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

/**
 * A realistic assembly of components in their current form (a form, a table in
 * a card, a dialog), shown below the isolated specimens.
 */
export function Composition({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-composition={title}
      className="flex flex-col gap-3 border-t border-border-subtle pt-6"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-subheading">
          <span className="text-muted-foreground">Composition · </span>
          {title}
        </h3>
        {description ? (
          <p className="max-w-prose text-small text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Note shown where a section can't show something yet. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted p-4 text-small text-muted-foreground">
      {children}
    </p>
  );
}
