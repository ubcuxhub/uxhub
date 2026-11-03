import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Building blocks for docs demos. A group's specimens share one stage: a quiet
 * panel where each component sits at its natural size with its caption
 * beneath, in a centred row that wraps. `data-specimen` makes them easy to
 * query when measuring in the browser.
 */

export function SpecimenGroup({
  title,
  spec,
  description,
  surface = "section",
  className,
  children,
}: {
  title: string;
  /** Design-system reference, "§3.1". */
  spec?: string;
  description?: ReactNode;
  /**
   * The stage's fill. `page` draws it in the page colour with a hairline edge,
   * for components that are themselves filled with bg-section.
   */
  surface?: "section" | "page";
  /** Classes for the stage. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-specimen-group={title} className="flex min-w-0 scroll-mt-20 flex-col gap-3">
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
      {/* The padding follows the stage's own width, so a Side by side column
          gets the phone padding. Specimens stretch to their row's height, so
          components line up along the top and captions along the bottom. */}
      <div className="@container min-w-0">
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-stretch justify-center gap-x-10 gap-y-8 rounded-2xl px-4 py-6 @lg:p-8",
            surface === "section"
              ? "bg-section"
              : "border border-border-subtle bg-background",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Specimen({
  label,
  wide = false,
  className,
  children,
}: {
  /** Caption: the variant, size or state shown, e.g. "outline / default". */
  label: string;
  /** Take a whole row of the stage; the content may stretch to fill it. */
  wide?: boolean;
  /** Classes for the specimen, usually a width for content that fills its container. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure
      data-specimen={label}
      className={cn(
        "m-0 flex min-w-0 max-w-full flex-col items-center justify-between gap-3",
        wide && "basis-full",
        className,
      )}
    >
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-3">
        {children}
      </div>
      <figcaption className="max-w-full text-center text-label text-muted-foreground">
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
      className="flex min-w-0 scroll-mt-20 flex-col gap-3 border-t border-border-subtle pt-6"
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
